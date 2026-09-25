import "server-only";

import * as cheerio from "cheerio";

import makeFetchCookie from "fetch-cookie";

import { requireUser } from "@/lib/auth/require-user";

import { getStudyCredentials } from "@/features/study/lib/get-study-credentials";

const COOL_BASE_URL = "https://cool.ntu.edu.tw";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

type SessionFetch = typeof fetch;

/*
 * IMPORTANT:
 *
 * Session must be separated by
 * Supabase user ID.
 *
 * Otherwise two users could accidentally
 * share the same COOL session.
 */
const sessionCache = new Map<string, SessionFetch>();

const loginPromises = new Map<string, Promise<SessionFetch>>();

function resolveAction(action: string | undefined, pageUrl: string) {
  return new URL(action || pageUrl, pageUrl).toString();
}

function collectInputs(
  $: cheerio.CheerioAPI,
  form: ReturnType<cheerio.CheerioAPI>,
) {
  const params = new URLSearchParams();

  form.find("input[name]").each((_, element) => {
    const input = $(element);

    const name = input.attr("name");

    if (!name) {
      return;
    }

    const type = (input.attr("type") ?? "").toLowerCase();

    if ((type === "checkbox" || type === "radio") && !input.is(":checked")) {
      return;
    }

    params.append(name, input.attr("value") ?? "");
  });

  return params;
}

function parseAdfsLoginForm(
  html: string,
  pageUrl: string,
  username: string,
  password: string,
) {
  const $ = cheerio.load(html);

  let form = $("form")
    .filter(
      (_, element) => $(element).find('input[type="password"]').length > 0,
    )
    .first();

  if (form.length === 0) {
    form = $("form").first();
  }

  if (form.length === 0) {
    throw new Error("Could not find NTU ADFS login form.");
  }

  const passwordInput = form.find('input[type="password"][name]').first();

  const passwordName = passwordInput.attr("name");

  if (!passwordName) {
    throw new Error("Could not find NTU ADFS password field.");
  }

  let usernameName = form
    .find('input[name="ctl00$ContentPlaceHolder1$UsernameTextBox"]')
    .attr("name");

  if (!usernameName) {
    form.find("input[name]").each((_, element) => {
      if (usernameName) {
        return;
      }

      const input = $(element);

      const name = input.attr("name");

      const type = (input.attr("type") ?? "text").toLowerCase();

      if (!name) {
        return;
      }

      const normalized = name.toLowerCase();

      if (
        (type === "text" || type === "email") &&
        (normalized.includes("user") || normalized.includes("login"))
      ) {
        usernameName = name;
      }
    });
  }

  if (!usernameName) {
    throw new Error("Could not find NTU ADFS username field.");
  }

  const fields = collectInputs($, form);

  fields.set(usernameName, username);

  fields.set(passwordName, password);

  return {
    action: resolveAction(form.attr("action"), pageUrl),

    fields,
  };
}

function parseSamlForm(html: string, pageUrl: string) {
  const $ = cheerio.load(html);

  const samlInput = $('input[name="SAMLResponse"]').first();

  if (samlInput.length === 0) {
    throw new Error("NTU login succeeded, but no SAML response was found.");
  }

  const form = samlInput.closest("form");

  if (form.length === 0) {
    throw new Error("Could not find SAML callback form.");
  }

  return {
    action: resolveAction(form.attr("action"), pageUrl),

    fields: collectInputs($, form),
  };
}

async function postForm(
  sessionFetch: SessionFetch,
  url: string,
  fields: URLSearchParams,
  referer: string,
) {
  return sessionFetch(url, {
    method: "POST",

    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",

      "Content-Type": "application/x-www-form-urlencoded",

      Referer: referer,

      "User-Agent": USER_AGENT,
    },

    body: fields.toString(),

    redirect: "follow",

    cache: "no-store",
  });
}

async function verifySession(sessionFetch: SessionFetch) {
  const response = await sessionFetch(
    `${COOL_BASE_URL}/api/v1/users/self/profile`,
    {
      headers: {
        Accept: "application/json",

        "User-Agent": USER_AGENT,
      },

      cache: "no-store",
    },
  );

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error("NTU COOL session verification failed.");
  }
}

async function loginNtuCool(userId: string): Promise<SessionFetch> {
  const credentials = getStudyCredentials(userId);

  const username = credentials.coolUsername;

  const password = credentials.coolPassword;

  /*
   * A new decorated fetch means
   * a completely separate cookie jar.
   */
  const sessionFetch = makeFetchCookie(fetch) as SessionFetch;

  const loginPage = await sessionFetch(`${COOL_BASE_URL}/login/saml/`, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",

      "User-Agent": USER_AGENT,
    },

    redirect: "follow",

    cache: "no-store",
  });

  if (!loginPage.ok) {
    throw new Error(
      `NTU COOL login initialization failed (${loginPage.status}).`,
    );
  }

  const loginHtml = await loginPage.text();

  const adfsForm = parseAdfsLoginForm(
    loginHtml,
    loginPage.url,
    username,
    password,
  );

  const adfsResponse = await postForm(
    sessionFetch,
    adfsForm.action,
    adfsForm.fields,
    loginPage.url,
  );

  if (!adfsResponse.ok) {
    throw new Error(`NTU ADFS login failed (${adfsResponse.status}).`);
  }

  const samlHtml = await adfsResponse.text();

  const samlForm = parseSamlForm(samlHtml, adfsResponse.url);

  const coolResponse = await postForm(
    sessionFetch,
    samlForm.action,
    samlForm.fields,
    adfsResponse.url,
  );

  if (!coolResponse.ok) {
    throw new Error(`NTU COOL SAML callback failed (${coolResponse.status}).`);
  }

  await verifySession(sessionFetch);

  return sessionFetch;
}

export async function getNtuCoolSessionFetch(): Promise<SessionFetch> {
  /*
   * Determine which An & Yao user
   * is making this request.
   */
  const user = await requireUser();

  const userId = user.id;

  const cached = sessionCache.get(userId);

  if (cached) {
    return cached;
  }

  const existingLogin = loginPromises.get(userId);

  if (existingLogin) {
    return existingLogin;
  }

  const promise = loginNtuCool(userId);

  loginPromises.set(userId, promise);

  try {
    const session = await promise;

    sessionCache.set(userId, session);

    return session;
  } finally {
    loginPromises.delete(userId);
  }
}

export function invalidateNtuCoolSession() {
  /*
   * Simplest safe behaviour:
   * invalidate every cached COOL session.
   *
   * A future request will recreate only
   * the current user's session.
   */
  sessionCache.clear();

  loginPromises.clear();
}
