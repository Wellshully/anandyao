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

function formatTaskDueAt(dueAt: string | null) {
  if (!dueAt) {
    return "未指定期限";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dueAt));
}

export async function buildPetContext(memoryQuery: string) {
  const user = await requireUser();

  const supabase = await createClient();

  const pet = await getPet();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  /*
   * Long-term memories are locally selected
   * according to the current conversation.
   *
   * Tasks are different: they are explicit,
   * structured pending responsibilities belonging
   * only to the current logged-in user.
   */
  const [memories, pendingTasks] = await Promise.all([
    selectPetMemories({
      petId: pet.id,
      currentUserId: user.id,
      query: memoryQuery,
    }),

    getPendingPetTasks(),
  ]);

  /*
   * Recent physical interactions are separate
   * from long-term memories.
   */
  const { data: events, error: eventsError } = await supabase
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
    throw new Error(eventsError.message);
  }

  const userIds = [...new Set((events ?? []).map((event) => event.user_id))];

  const nameByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    for (const item of profiles ?? []) {
      nameByUserId.set(item.id, item.display_name);
    }
  }

  const recentEvents = (events ?? []).map((event) => {
    const actor = nameByUserId.get(event.user_id) ?? "其中一位主人";

    const action = EVENT_LABELS[event.event_type] ?? event.event_type;

    return `${actor}：${action}`;
  });

  const memoryLines = memories.map((memory) => {
    const importanceLabel =
      memory.importance === 3
        ? "核心記憶"
        : memory.importance === 2
          ? "長期記憶"
          : "近期記憶";

    return `- [${importanceLabel}] ${memory.subjectName}：${memory.content}`;
  });

  const taskLines = pendingTasks.map((task) => {
    const dueLabel = formatTaskDueAt(task.dueAt);

    const noteLabel = task.note ? `；補充：${task.note}` : "";

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

最近的互動：
${
  recentEvents.length > 0
    ? recentEvents.map((event) => `- ${event}`).join("\n")
    : "- 最近還沒有互動紀錄"
}

你記得的事情：
${
  memoryLines.length > 0
    ? memoryLines.join("\n")
    : "- 目前沒有和這個話題直接相關的長期記憶"
}

目前正在和你說話的主人自己的待辦：
${
  taskLines.length > 0
    ? taskLines.join("\n")
    : "- 目前沒有萌蛋替這位主人記住的待辦"
}

待辦隱私規則：
- 上面的待辦只屬於目前正在和你說話的主人。
- 不可以把這些待辦當成另一位主人的事情。

待辦 ID 規則：
- taskId 是系統內部識別碼。
- taskId 只能用於 taskActions 的 complete / cancel 操作。
- 絕對不要在正常回答中向主人顯示 taskId。
`.trim();
}
