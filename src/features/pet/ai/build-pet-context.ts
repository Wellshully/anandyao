import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { selectPetMemories } from "@/features/pet/ai/select-pet-memories";
import { getPendingPetTasks } from "@/features/pet/ai/get-pending-pet-tasks";

import { getPet } from "@/features/pet/lib/get-pet";

const EVENT_LABELS: Record<string, string> = {
  feed: "餵食",
  pet: "摸摸",
  play: "玩耍",
};

function formatTaskDueAt(
  dueAt: string | null,
) {
  if (!dueAt) {
    return "未指定期限";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(new Date(dueAt));
}

function formatEventCreatedAt(
  createdAt: string,
) {
  const date = new Date(createdAt);

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return "時間未知";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(date);
}

type BuildPetContextOptions = {
  includeMemories?: boolean;
  includePendingTasks?: boolean;
};

export async function buildPetContext(
  memoryQuery: string,
  {
    includeMemories = true,
    includePendingTasks = false,
  }: BuildPetContextOptions = {},
) {
  const user = await requireUser();

  const supabase =
    await createClient();

  const pet = await getPet();

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(
      profileError.message,
    );
  }

  /*
   * Memories and Tasks are intentionally
   * routed separately.
   *
   * Memories:
   * semantic background knowledge.
   *
   * Tasks:
   * structured responsibilities belonging
   * only to the current logged-in user.
   *
   * Tasks must not automatically enter every
   * normal conversation.
   */
  const [
    memories,
    pendingTasks,
  ] = await Promise.all([
    includeMemories
      ? selectPetMemories({
          petId: pet.id,
          currentUserId: user.id,
          query: memoryQuery,
        })
      : Promise.resolve([]),

    includePendingTasks
      ? getPendingPetTasks()
      : Promise.resolve([]),
  ]);

  /*
   * Pet interactions are actual timestamped
   * events, so preserve their timestamps.
   *
   * Never reduce them to a timeless
   * "recent interaction" statement.
   */
  const {
    data: events,
    error: eventsError,
  } = await supabase
    .from("pet_events")
    .select(
      `
        user_id,
        event_type,
        created_at
      `,
    )
    .eq("pet_id", pet.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(12);

  if (eventsError) {
    throw new Error(
      eventsError.message,
    );
  }

  const userIds = [
    ...new Set(
      (events ?? []).map(
        (event) =>
          event.user_id,
      ),
    ),
  ];

  const nameByUserId =
    new Map<string, string>();

  if (userIds.length > 0) {
    const {
      data: profiles,
      error: profilesError,
    } = await supabase
      .from("profiles")
      .select(
        "id, display_name",
      )
      .in("id", userIds);

    if (profilesError) {
      throw new Error(
        profilesError.message,
      );
    }

    for (
      const item of profiles ?? []
    ) {
      nameByUserId.set(
        item.id,
        item.display_name,
      );
    }
  }

  const recentEvents =
    (events ?? []).map(
      (event) => {
        const actor =
          nameByUserId.get(
            event.user_id,
          ) ??
          "其中一位主人";

        const action =
          EVENT_LABELS[
            event.event_type
          ] ??
          event.event_type;

        const timestamp =
          formatEventCreatedAt(
            event.created_at,
          );

        return (
          `[${timestamp}] ` +
          `${actor}：${action}`
        );
      },
    );

  const memoryLines =
    memories.map((memory) => {
      const importanceLabel =
        memory.importance === 3
          ? "核心記憶"
          : memory.importance === 2
            ? "長期記憶"
            : "近期記憶";

      return (
        `- [${importanceLabel}] ` +
        `${memory.subjectName}：` +
        memory.content
      );
    });

  const taskLines =
    pendingTasks.map((task) => {
      const dueLabel =
        formatTaskDueAt(
          task.dueAt,
        );

      const noteLabel =
        task.note
          ? `；補充：${task.note}`
          : "";

      return [
        `- taskId: ${task.id}`,
        `  標題：${task.title}`,
        `  期限：${dueLabel}${noteLabel}`,
      ].join("\n");
    });

  const state = pet.state;

  return `
目前正在跟你說話的人：
${profile.display_name}

你的名字：
${pet.name}

你的目前狀態：
- 等級：Lv.${state.level}
- XP：${Math.round(state.xp)}
- 飽足：${Math.round(state.hunger)} / 100
- 心情：${Math.round(state.happiness)} / 100
- 精力：${Math.round(state.energy)} / 100
- 當前情緒：${state.mood}

最近與萌蛋的實際互動：
${
  recentEvents.length > 0
    ? recentEvents
        .map(
          (event) =>
            `- ${event}`,
        )
        .join("\n")
    : "- 最近還沒有互動紀錄"
}

語意記憶：
注意：下面的記憶是背景知識。
除非記憶內容本身明確包含日期，
否則不能用它判斷事情是「剛剛」、
「今天」、「昨天」或任何特定時間發生的。
${
  memoryLines.length > 0
    ? memoryLines.join("\n")
    : "- 這一輪沒有提供相關長期記憶"
}

${
  includePendingTasks
    ? `
目前正在和你說話的主人自己的 pending 待辦：
${
  taskLines.length > 0
    ? taskLines.join("\n")
    : "- 目前沒有萌蛋替這位主人記住的 pending 待辦"
}

待辦隱私規則：
- 上面的待辦只屬於目前正在和你說話的主人。
- 不可以把這些待辦當成另一位主人的事情。
- 如果主人詢問另一位主人的待辦，不可以使用這份清單回答。

待辦時間規則：
- pending 只代表「還沒標記完成」。
- pending 不代表主人現在正在做這件事。
- dueAt 只代表期限。
- 絕對不能因為一件 task 存在，就推論主人剛剛、現在或今天正在做它。

待辦 ID 規則：
- taskId 是系統內部識別碼。
- taskId 只能用於 taskActions 的 complete / cancel。
- 絕對不要在正常回答中顯示 taskId。
`
    : `
待辦清單：
- 這一輪沒有載入 pending task 清單。
- 不可以自行假設主人有哪些待辦。
`
}
  `.trim();
}
