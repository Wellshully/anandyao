import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type Pop3Command from "node-pop3";

import {
  getRecentNtuMailHeadersFromClient,
  type NtuMailHeader,
} from "./ntu-webmail-client";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(),
}));

vi.mock(
  "@/features/study/lib/get-study-credentials",
  () => ({
    getStudyCredentials: vi.fn(),
  }),
);

vi.mock("postal-mime", () => ({
  default: {
    parse: vi.fn(async (raw: string) => ({
      subject: raw,
      from: {
        name: "Test sender",
        address: "sender@example.com",
      },
      date: null,
      messageId: null,
    })),
  },
}));

function storedHeader(
  uidl: string,
  subject: string,
): NtuMailHeader {
  return {
    uidl,
    subject,
    fromName: "Stored sender",
    fromAddress: "stored@example.com",
    sentAt: null,
    messageId: null,
  };
}

function fakePop3(
  rows: Array<[string, string]>,
  retrieve: (messageNumber: number) => Promise<string>,
) {
  const UIDL = vi.fn(async () => rows);

  const TOP = vi.fn(
    async (messageNumber: number, lines: number) => {
      if (lines !== 0) {
        throw new Error(
          "Expected a header-only POP3 TOP call.",
        );
      }

      return retrieve(messageNumber);
    },
  );

  const QUIT = vi.fn(async () => undefined);

  const client = {
    UIDL,
    TOP,
    QUIT,
  } as unknown as Pop3Command;

  return {
    client,
    UIDL,
    TOP,
    QUIT,
  };
}

describe("incremental NTU POP3 header loading", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(
      () => undefined,
    );

    vi.spyOn(console, "error").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses every cached header without TOP", async () => {
    const pop3 = fakePop3(
      [
        ["1", "older"],
        ["2", "newer"],
      ],
      async () => {
        throw new Error("TOP must not run");
      },
    );

    const resolveCached = vi.fn(
      async (uidls: string[]) => {
        expect(uidls).toEqual([
          "newer",
          "older",
        ]);

        return new Map([
          ["older", storedHeader("older", "Old")],
          ["newer", storedHeader("newer", "New")],
        ]);
      },
    );

    const headers =
      await getRecentNtuMailHeadersFromClient(
        pop3.client,
        50,
        resolveCached,
      );

    expect(headers.map((mail) => mail.uidl)).toEqual([
      "newer",
      "older",
    ]);

    expect(resolveCached).toHaveBeenCalledTimes(1);
    expect(pop3.TOP).not.toHaveBeenCalled();
    expect(pop3.QUIT).toHaveBeenCalledTimes(1);

    expect(console.info).toHaveBeenCalledWith(
      "[study.mail-sync] POP3 headers loaded:",
      expect.objectContaining({
        cachedHeaders: 2,
        fetchedHeaders: 0,
        totalHeaders: 2,
      }),
    );
  });

  it("fetches only missing headers and preserves order", async () => {
    const pop3 = fakePop3(
      [
        ["1", "older"],
        ["2", "newer"],
      ],
      async () => "Fresh subject",
    );

    const headers =
      await getRecentNtuMailHeadersFromClient(
        pop3.client,
        50,
        async () =>
          new Map([
            [
              "older",
              storedHeader("older", "Stored subject"),
            ],
          ]),
      );

    expect(headers.map((mail) => mail.uidl)).toEqual([
      "newer",
      "older",
    ]);

    expect(headers.map((mail) => mail.subject)).toEqual([
      "Fresh subject",
      "Stored subject",
    ]);

    expect(pop3.TOP).toHaveBeenCalledTimes(1);
    expect(pop3.TOP).toHaveBeenCalledWith(2, 0);
    expect(pop3.QUIT).toHaveBeenCalledTimes(1);
  });

  it("reports a timeout on the third TOP without false success", async () => {
    const timeoutError = Object.assign(
      new Error("POP3 timeout"),
      {
        eventName: "timeout",
      },
    );

    const pop3 = fakePop3(
      [
        ["1", "problem"],
        ["2", "second"],
        ["3", "first"],
      ],
      async (number) => {
        if (number === 1) {
          throw timeoutError;
        }

        return `Subject ${number}`;
      },
    );

    await expect(
      getRecentNtuMailHeadersFromClient(
        pop3.client,
        50,
        async () => new Map(),
      ),
    ).rejects.toBe(timeoutError);

    expect(pop3.TOP).toHaveBeenCalledTimes(3);
    expect(pop3.QUIT).toHaveBeenCalledTimes(1);

    expect(console.error).toHaveBeenCalledWith(
      "[study.mail-sync] POP3 header fetch failed:",
      expect.objectContaining({
        stage: "TOP",
        completedHeaders: 2,
        fetchedHeaders: 2,
        eventName: "timeout",
      }),
    );
  });

  it("closes POP3 when cached-header lookup fails", async () => {
    const pop3 = fakePop3(
      [["1", "mail"]],
      async () => "Should not fetch",
    );

    const databaseError = new Error(
      "Cached header lookup failed",
    );

    await expect(
      getRecentNtuMailHeadersFromClient(
        pop3.client,
        50,
        async () => {
          throw databaseError;
        },
      ),
    ).rejects.toBe(databaseError);

    expect(pop3.TOP).not.toHaveBeenCalled();
    expect(pop3.QUIT).toHaveBeenCalledTimes(1);

    expect(console.error).toHaveBeenCalledWith(
      "[study.mail-sync] POP3 header fetch failed:",
      expect.objectContaining({
        stage: "cache-lookup",
      }),
    );
  });

  it("honors the limit without a cache resolver", async () => {
    const pop3 = fakePop3(
      [
        ["1", "oldest"],
        ["2", "middle"],
        ["3", "newest"],
      ],
      async (number) => `Subject ${number}`,
    );

    const headers =
      await getRecentNtuMailHeadersFromClient(
        pop3.client,
        2,
      );

    expect(headers.map((mail) => mail.uidl)).toEqual([
      "newest",
      "middle",
    ]);

    expect(pop3.TOP).toHaveBeenCalledTimes(2);
    expect(pop3.TOP).toHaveBeenNthCalledWith(1, 3, 0);
    expect(pop3.TOP).toHaveBeenNthCalledWith(2, 2, 0);
    expect(pop3.QUIT).toHaveBeenCalledTimes(1);
  });
});
