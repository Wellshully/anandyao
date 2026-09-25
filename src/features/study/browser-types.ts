export type StudyCourseItem = {
  id: string;

  coolCourseId: number;

  name: string;

  courseCode: string | null;
};

export type StudyAssignmentItem = {
  id: string;

  coolAssignmentId: number;

  coolCourseId: number;

  courseName: string;

  title: string;

  dueAt: string | null;

  submitted: boolean;

  submissionState: string | null;

  submittedAt: string | null;

  late: boolean;

  missing: boolean;

  htmlUrl: string;
};

export type StudyAnnouncementItem = {
  id: string;

  coolAnnouncementId: number;

  coolCourseId: number;

  courseName: string;

  title: string;

  postedAt: string | null;

  /*
   * Original COOL state.
   * We keep it only as source metadata.
   */
  readState: "read" | "unread";

  /*
   * An & Yao local read state.
   */
  seenAt: string | null;

  htmlUrl: string;
};

export type StudyBrowserData = {
  courses: StudyCourseItem[];

  assignments: StudyAssignmentItem[];

  announcements: StudyAnnouncementItem[];
};
