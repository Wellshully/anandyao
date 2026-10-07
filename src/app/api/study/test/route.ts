import { NextResponse } from "next/server";

import {
  getNtuCoolCourses,
  getNtuCoolProfile,
} from "@/features/study/lib/ntu-cool-client";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", {
      status: 404,
    });
  }


  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

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
    const [profile, courses] = await Promise.all([
      getNtuCoolProfile(),
      getNtuCoolCourses(),
    ]);

    /*
     * Return only what we need for testing.
     * Never return the access token.
     */
    return NextResponse.json({
      success: true,

      profile: {
        id: profile.id,

        name: profile.name,
      },

      courses: courses.map((course) => ({
        id: course.id,

        name: course.name,

        code: course.course_code ?? null,
      })),
    });
  } catch (cause) {
    console.error("Study API test:", cause);

    return NextResponse.json(
      {
        success: false,

        error:
          cause instanceof Error ? cause.message : "NTU COOL request failed.",
      },
      {
        status: 500,
      },
    );
  }
}
