import "server-only";
import {
  getNtuCoolSessionFetch,
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
async function ntuCoolFetch<T>(path: string): Promise<T> {
  async function request() {
    const sessionFetch = await getNtuCoolSessionFetch();

    return sessionFetch(`${NTU_COOL_API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
      },

      cache: "no-store",

      redirect: "follow",
    });
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

  let response = await request();

  /*
   * A Canvas session can expire.
   *
   * In that case throw away our cookie
   * jar, perform the ADFS login again,
   * then retry exactly once.
   */
  if (isLoggedOut(response)) {
    invalidateNtuCoolSession();

    response = await request();
  }

  if (isLoggedOut(response)) {
    throw new NtuCoolApiError(401, path);
  }

  if (!response.ok) {
    const text = await response.text();

    console.error("NTU COOL API error:", {
      status: response.status,

      path,

      body: text.slice(0, 500),
    });

    throw new NtuCoolApiError(response.status, path);
  }

  const contentType = response.headers.get("content-type") ?? "";

  /*
   * If Canvas silently redirected to a
   * login page instead of returning 401,
   * don't try to parse HTML as JSON.
   */
  if (!contentType.includes("application/json")) {
    invalidateNtuCoolSession();

    throw new NtuCoolApiError(401, path);
  }

  return response.json() as Promise<T>;
}
export async function getNtuCoolProfile() {
  return ntuCoolFetch<NtuCoolProfile>("/users/self/profile");
}

export async function getNtuCoolCourses() {
  return ntuCoolFetch<NtuCoolCourse[]>(
    "/courses?enrollment_state=active&per_page=50",
  );
}

export async function getNtuCoolAssignments(courseId: number) {
  const params = new URLSearchParams();

  params.set("order_by", "due_at");

  params.set("per_page", "100");

  params.append("include[]", "submission");

  return ntuCoolFetch<NtuCoolAssignment[]>(
    `/courses/${courseId}/assignments?${params.toString()}`,
  );
}
export async function getNtuCoolAnnouncements(courseIds: number[]) {
  if (courseIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams();

  for (const courseId of courseIds) {
    params.append("context_codes[]", `course_${courseId}`);
  }

  params.set("active_only", "true");

  params.set("per_page", "100");

  return ntuCoolFetch<NtuCoolAnnouncement[]>(
    `/announcements?${params.toString()}`,
  );
}
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
