import { NextResponse } from "next/server";

import {
  getNtuCoolAnnouncements,
  getNtuCoolCourses,
} from "@/features/study/lib/ntu-cool-client";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", {
      status: 404,
    });
  }


  const supabase = await createClient();

  const {
    data: authData,

    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const courses = await getNtuCoolCourses();

    const courseIds = courses.map((course) => course.id);

    const announcements = await getNtuCoolAnnouncements(courseIds);

    const courseMap = new Map(courses.map((course) => [course.id, course]));

    const normalized = announcements.map((announcement) => {
      const match = /^course_(\d+)$/.exec(announcement.context_code);

      const courseId = match ? Number(match[1]) : null;

      const course = courseId ? courseMap.get(courseId) : undefined;

      return {
        id: announcement.id,

        title: announcement.title,

        postedAt: announcement.posted_at,

        readState: announcement.read_state,

        courseId,

        courseName: course?.name ?? null,

        url: announcement.html_url,
      };
    });

    const unread = normalized.filter(
      (announcement) => announcement.readState === "unread",
    );

    return NextResponse.json({
      success: true,

      totalAnnouncements: normalized.length,

      unreadAnnouncements: unread.length,

      announcements: normalized,
    });
  } catch (cause) {
    console.error("Study announcements test:", cause);

    return NextResponse.json(
      {
        success: false,

        error:
          cause instanceof Error
            ? cause.message
            : "Failed to load announcements.",
      },
      {
        status: 500,
      },
    );
  }
}
