import "server-only";

import Pop3Command from "node-pop3";
import PostalMime from "postal-mime";

import { requireUser } from "@/lib/auth/require-user";

import { getStudyCredentials } from "@/features/study/lib/get-study-credentials";

import type { Address, Mailbox } from "postal-mime";

const host = process.env.NTU_MAIL_HOST ?? "msa.ntu.edu.tw";

const port = Number(process.env.NTU_MAIL_PORT ?? "995");

async function createPop3ClientForUser(userId: string) {
  const credentials = getStudyCredentials(userId);

  return new Pop3Command({
    user: credentials.mailUsername,

    password: credentials.mailPassword,

    host,
    port,

    servername: host,

    tls: true,

    timeout: 15_000,

    streamReadTimeout: 15_000,

    parseStreamToString: true,

    maxMailSize: 15 * 1024 * 1024,

    tlsOptions: {
      rejectUnauthorized: true,
    },
  });
}

async function createPop3Client() {
  const user = await requireUser();

  return createPop3ClientForUser(user.id);
}

/*
 * node-pop3 types RETR / TOP as
 * string | Stream.
 *
 * Even with parseStreamToString=true,
 * TypeScript still sees both possibilities.
 */
async function pop3ResultToString(
  result: Awaited<ReturnType<Pop3Command["RETR"]>>,
) {
  if (typeof result === "string") {
    return result;
  }

  return Pop3Command.stream2String(result);
}

function getMailbox(address: Address | undefined): Mailbox | null {
  if (!address) {
    return null;
  }

  if ("group" in address && address.group) {
    return address.group[0] ?? null;
  }

  return address as Mailbox;
}

export type NtuMailHeader = {
  uidl: string;

  subject: string;

  fromName: string | null;

  fromAddress: string | null;

  sentAt: string | null;

  messageId: string | null;
};

export type NtuMailHeaderCacheResolver = (
  uidls: string[],
) => Promise<Map<string, NtuMailHeader>>;

export async function getRecentNtuMailHeadersFromClient(
  pop3: Pop3Command,
  limit: number,
  resolveCached?: NtuMailHeaderCacheResolver,
): Promise<NtuMailHeader[]> {
  const startedAt = Date.now();

  let stage = "UIDL";
  let completedHeaders = 0;
  let cachedHeaders = 0;
  let fetchedHeaders = 0;

  try {
    const uidRows = await pop3.UIDL();

    const latest = uidRows
      .map((row) => ({
        messageNumber: Number(row[0]),

        uidl: String(row[1]),
      }))
      .filter(
        (item) => Number.isFinite(item.messageNumber) && Boolean(item.uidl),
      )
      .sort((a, b) => b.messageNumber - a.messageNumber)
      .slice(0, limit);

    stage = "cache-lookup";

    const cached = resolveCached
      ? await resolveCached(
          latest.map((item) => item.uidl),
        )
      : new Map<string, NtuMailHeader>();

    const messages: NtuMailHeader[] = [];

    /*
     * Sequential intentionally.
     *
     * POP3 uses one connection
     * and commands should remain
     * ordered.
     */
    for (const item of latest) {
      const existing = cached.get(item.uidl);

      if (existing) {
        messages.push(existing);
        cachedHeaders += 1;
        completedHeaders += 1;
        continue;
      }

      stage = "TOP";

      const result = await pop3.TOP(
        item.messageNumber,
        0,
      );

      stage = "TOP-stream";

      const rawHeader = await pop3ResultToString(result);

      stage = "parse-header";

      const parsed = await PostalMime.parse(rawHeader);

      const from = getMailbox(parsed.from);

      messages.push({
        uidl: item.uidl,

        subject: parsed.subject?.trim() || "(無主旨)",

        fromName: from?.name?.trim() || null,

        fromAddress: from?.address?.trim() || null,

        sentAt: parsed.date || null,

        messageId: parsed.messageId || null,
      });

      completedHeaders += 1;
      fetchedHeaders += 1;
    }

    console.info(
      "[study.mail-sync] POP3 headers loaded:",
      {
        elapsedMs: Date.now() - startedAt,
        cachedHeaders,
        fetchedHeaders,
        totalHeaders: messages.length,
      },
    );

    return messages;
  } catch (cause) {
    /*
     * Never log the POP3 command or raw error
     * object: authentication commands may carry
     * credentials.
     */
    const eventName =
      cause &&
      typeof cause === "object" &&
      "eventName" in cause &&
      typeof cause.eventName === "string"
        ? cause.eventName
        : null;

    console.error(
      "[study.mail-sync] POP3 header fetch failed:",
      {
        stage,
        elapsedMs: Date.now() - startedAt,
        completedHeaders,
        cachedHeaders,
        fetchedHeaders,
        requestedLimit: limit,
        eventName,
      },
    );

    throw cause;
  } finally {
    try {
      await pop3.QUIT();
    } catch {
      /*
       * Connection may already
       * have been closed.
       */
    }
  }
}

export async function getRecentNtuMailHeaders(
  limit = 50,
): Promise<NtuMailHeader[]> {
  const pop3 = await createPop3Client();

  return getRecentNtuMailHeadersFromClient(pop3, limit);
}

/*
 * Background / cron version.
 *
 * Does not require a browser
 * session or requireUser().
 */
export async function getRecentNtuMailHeadersForUser(
  userId: string,
  limit = 50,
  resolveCached?: NtuMailHeaderCacheResolver,
): Promise<NtuMailHeader[]> {
  const startedAt = Date.now();

  let pop3: Pop3Command;

  try {
    pop3 = await createPop3ClientForUser(userId);
  } catch (cause) {
    /*
     * Avoid logging the raw POP3 error:
     * it may contain connection or login details.
     */
    console.error(
      "[study.mail-sync] POP3 client initialization failed:",
      {
        stage: "client-init",
        elapsedMs: Date.now() - startedAt,
      },
    );

    throw cause;
  }

  return getRecentNtuMailHeadersFromClient(
    pop3,
    limit,
    resolveCached,
  );
}

async function getNtuMailByUidlFromClient(pop3: Pop3Command, uidl: string) {
  try {
    const uidRows = await pop3.UIDL();

    const match = uidRows.find((row) => String(row[1]) === uidl);

    if (!match) {
      return null;
    }

    const messageNumber = Number(match[0]);

    if (!Number.isFinite(messageNumber)) {
      return null;
    }

    const result = await pop3.RETR(messageNumber);

    const raw = await pop3ResultToString(result);

    return PostalMime.parse(raw);
  } finally {
    try {
      await pop3.QUIT();
    } catch {
      /*
       * Ignore disconnect
       * errors.
       */
    }
  }
}

export async function getNtuMailByUidl(uidl: string) {
  const pop3 = await createPop3Client();

  return getNtuMailByUidlFromClient(pop3, uidl);
}

export async function getNtuMailByUidlForUser(userId: string, uidl: string) {
  const pop3 = await createPop3ClientForUser(userId);

  return getNtuMailByUidlFromClient(pop3, uidl);
}
