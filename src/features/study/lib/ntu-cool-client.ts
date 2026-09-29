import "server-only";

import {
  getNtuCoolSessionFetch,
  getNtuCoolSessionFetchForUser,
  invalidateNtuCoolSession,
} from "@/features/study/lib/ntu-cool-session";

const NTU_COOL_API_BASE = "https://cool.ntu.edu.tw/api/v1";

export type NtuCoolProfile = {
  id: number;
  name: string;
  short_name?: string;
  sortable_name?: string;
  login_id?: string;
};

export type NtuCoolCourse = {
  id: number;
  name: string;
  course_code?: string;
  workflow_state?: string;
};

export type NtuCoolSubmission = {
  id?: number;

  submitted_at: string | null;

  workflow_state: string;

  late?: boolean;

  missing?: boolean;

  excused?: boolean | null;

  attempt?: number | null;
};

export type NtuCoolAssignment = {
  id: number;

  name: string;

  description?: string | null;

  due_at: string | null;

  html_url: string;

  points_possible?: number | null;

  submission_types?: string[];

  submission?: NtuCoolSubmission | null;

  published?: boolean;
};

export type NtuCoolAnnouncement = {
  id: number;

  title: string;

  message: string | null;

  html_url: string;

  posted_at: string | null;

  read_state: "read" | "unread";

  unread_count: number;

  context_code: string;
};

export class NtuCoolApiError extends Error {
  status: number;

  path: string;

  constructor(status: number, path: string) {
    super(`NTU COOL API returned ${status}.`);

    this.name = "NtuCoolApiError";

    this.status = status;

    this.path = path;
  }
}

export function isNtuCoolAuthError(error: unknown) {
  return error instanceof NtuCoolApiError && error.status === 401;
}

function resolveNtuCoolApiUrl(pathOrUrl: string) {
  if (
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("http://")
  ) {
    const url = new URL(pathOrUrl);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "cool.ntu.edu.tw" ||
      !url.pathname.startsWith("/api/v1/")
    ) {
      throw new Error("Invalid NTU COOL pagination URL.");
    }

    return url.toString();
  }

  const path = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;

  return `${NTU_COOL_API_BASE}${path}`;
}

function isLoggedOut(response: Response) {
  if (response.status === 401) {
    return true;
  }

  try {
    const url = new URL(response.url);

    if (url.hostname === "adfs.ntu.edu.tw") {
      return true;
    }

    if (
      url.hostname === "cool.ntu.edu.tw" &&
      url.pathname.startsWith("/login")
    ) {
      return true;
    }
  } catch {
    // Ignore malformed response URL.
  }

  return false;
}

async function ntuCoolFetchResponse(
  pathOrUrl: string,
  userId?: string,
): Promise<Response> {
  async function request() {
    const sessionFetch = userId
      ? await getNtuCoolSessionFetchForUser(userId)
      : await getNtuCoolSessionFetch();

    return sessionFetch(resolveNtuCoolApiUrl(pathOrUrl), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "follow",
    });
  }

  let response = await request();

  /*
   * COOL / ADFS session can expire.
   *
   * Retry once with a fresh session.
   */
  if (isLoggedOut(response)) {
    invalidateNtuCoolSession(userId);

    response = await request();
  }

  if (isLoggedOut(response)) {
    throw new NtuCoolApiError(401, pathOrUrl);
  }

  if (!response.ok) {
    const body = await response.text();

    console.error("NTU COOL API error:", {
      status: response.status,
      path: pathOrUrl,
      body: body.slice(0, 500),
    });

    throw new NtuCoolApiError(
      response.status,
      pathOrUrl,
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  /*
   * Canvas can redirect to a HTML login page
   * instead of returning a clean 401.
   */
  if (!contentType.includes("application/json")) {
    invalidateNtuCoolSession(userId);

    throw new NtuCoolApiError(401, pathOrUrl);
  }

  return response;
}

async function ntuCoolFetch<T>(
  path: string,
  userId?: string,
): Promise<T> {
  const response =
    await ntuCoolFetchResponse(path, userId);

  return response.json() as Promise<T>;
}

function getNextPageUrl(
  response: Response,
): string | null {
  const linkHeader = response.headers.get("link");

  if (!linkHeader) {
    return null;
  }

  /*
   * Canvas pagination uses RFC-style Link headers:
   *
   * <...page=2>; rel="next"
   */
  const matches = linkHeader.matchAll(
    /<([^>]+)>\s*;\s*rel="([^"]+)"/gi,
  );

  for (const match of matches) {
    const relations = match[2]
      .split(/\s+/)
      .map((relation) =>
        relation.trim().toLowerCase(),
      );

    if (relations.includes("next")) {
      return match[1];
    }
  }

  return null;
}

async function ntuCoolFetchAllPages<T>(
  path: string,
  userId?: string,
): Promise<T[]> {
  const result: T[] = [];

  let nextUrl: string | null = path;

  /*
   * Safety guard against a malformed pagination loop.
   */
  let pageCount = 0;

  while (nextUrl) {
    pageCount += 1;

    if (pageCount > 100) {
      throw new Error(
        "NTU COOL pagination exceeded 100 pages.",
      );
    }

    const response =
      await ntuCoolFetchResponse(
        nextUrl,
        userId,
      );

    const page =
      (await response.json()) as unknown;

    if (!Array.isArray(page)) {
      throw new Error(
        "NTU COOL paginated response is not an array.",
      );
    }

    result.push(...(page as T[]));

    nextUrl = getNextPageUrl(response);
  }

  return result;
}

/*
 * ==========================================
 * Profile
 * ==========================================
 */

export async function getNtuCoolProfile() {
  return ntuCoolFetch<NtuCoolProfile>("/users/self/profile");
}

/*
 * ==========================================
 * Courses
 * ==========================================
 */

export async function getNtuCoolCourses() {
  return ntuCoolFetchAllPages<NtuCoolCourse>(
    "/courses?enrollment_state=active&per_page=100",
  );
}

export async function getNtuCoolCoursesForUser(userId: string) {
  return ntuCoolFetchAllPages<NtuCoolCourse>(
    "/courses?enrollment_state=active&per_page=100",
    userId,
  );
}

/*
 * ==========================================
 * Assignments
 * ==========================================
 */

function buildAssignmentListPath(courseId: number) {
  const params = new URLSearchParams();

  params.set("order_by", "due_at");

  params.set("per_page", "100");

  params.append("include[]", "submission");

  return `/courses/${courseId}/assignments?${params.toString()}`;
}

export async function getNtuCoolAssignments(courseId: number) {
  return ntuCoolFetchAllPages<NtuCoolAssignment>(
    buildAssignmentListPath(courseId),
  );
}

export async function getNtuCoolAssignmentsForUser(
  userId: string,
  courseId: number,
) {
  return ntuCoolFetchAllPages<NtuCoolAssignment>(
    buildAssignmentListPath(courseId),
    userId,
  );
}

/*
 * ==========================================
 * Announcements
 * ==========================================
 */

function buildAnnouncementListPath(courseIds: number[]) {
  const params = new URLSearchParams();

  for (const courseId of courseIds) {
    params.append("context_codes[]", `course_${courseId}`);
  }

  params.set("active_only", "true");

  params.set("per_page", "100");

  return `/announcements?${params.toString()}`;
}

export async function getNtuCoolAnnouncements(courseIds: number[]) {
  if (courseIds.length === 0) {
    return [];
  }

  return ntuCoolFetchAllPages<NtuCoolAnnouncement>(
    buildAnnouncementListPath(courseIds),
  );
}

export async function getNtuCoolAnnouncementsForUser(
  userId: string,
  courseIds: number[],
) {
  if (courseIds.length === 0) {
    return [];
  }

  return ntuCoolFetchAllPages<NtuCoolAnnouncement>(
    buildAnnouncementListPath(courseIds),
    userId,
  );
}

/*
 * ==========================================
 * Assignment detail
 * ==========================================
 */

export type NtuCoolAssignmentDetail = NtuCoolAssignment & {
  course_id?: number;

  unlock_at?: string | null;

  lock_at?: string | null;

  points_possible?: number | null;

  submission_types?: string[];
};

export async function getNtuCoolAssignment(
  courseId: number,
  assignmentId: number,
) {
  const params = new URLSearchParams();

  params.append("include[]", "submission");

  return ntuCoolFetch<NtuCoolAssignmentDetail>(
    `/courses/${courseId}/assignments/${assignmentId}?${params.toString()}`,
  );
}

/*
 * ==========================================
 * Announcement detail
 * ==========================================
 */

export type NtuCoolAnnouncementDetail = NtuCoolAnnouncement & {
  user_name?: string | null;

  delayed_post_at?: string | null;
};

export async function getNtuCoolAnnouncement(
  courseId: number,
  announcementId: number,
) {
  return ntuCoolFetch<NtuCoolAnnouncementDetail>(
    `/courses/${courseId}/discussion_topics/${announcementId}`,
  );
}
