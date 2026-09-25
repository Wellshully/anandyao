import "server-only";

import { getStudyBrowser } from "@/features/study/lib/get-study-browser";

export async function getStudyCourseDetail(coolCourseId: number) {
  const data = await getStudyBrowser();

  const course = data.courses.find(
    (item) => item.coolCourseId === coolCourseId,
  );

  if (!course) {
    return null;
  }

  const assignments = data.assignments.filter(
    (assignment) => assignment.coolCourseId === coolCourseId,
  );

  const announcements = data.announcements.filter(
    (announcement) => announcement.coolCourseId === coolCourseId,
  );

  return {
    course,
    assignments,
    announcements,
  };
}
