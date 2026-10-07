import { NextResponse } from "next/server";

import {
  getNtuCoolAssignments,
  getNtuCoolCourses,
} from "@/features/study/lib/ntu-cool-client";

import { isAssignmentSubmitted } from "@/features/study/lib/is-assignment-submitted";

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

    const coursesWithAssignments = await Promise.all(
      courses.map(async (course) => {
        const assignments = await getNtuCoolAssignments(course.id);

        const usefulAssignments = assignments
          .filter((assignment) => assignment.due_at !== null)
          .map((assignment) => ({
            id: assignment.id,

            name: assignment.name,

            dueAt: assignment.due_at,

            submitted: isAssignmentSubmitted(assignment),

            submissionState: assignment.submission?.workflow_state ?? null,

            submittedAt: assignment.submission?.submitted_at ?? null,

            late: assignment.submission?.late ?? false,

            missing: assignment.submission?.missing ?? false,

            url: assignment.html_url,
          }));

        return {
          course: {
            id: course.id,

            name: course.name,

            code: course.course_code ?? null,
          },

          assignments: usefulAssignments,
        };
      }),
    );

    return NextResponse.json({
      success: true,

      courses: coursesWithAssignments,
    });
  } catch (cause) {
    console.error("Study assignments test:", cause);

    return NextResponse.json(
      {
        success: false,

        error:
          cause instanceof Error
            ? cause.message
            : "Failed to load assignments.",
      },
      {
        status: 500,
      },
    );
  }
}
