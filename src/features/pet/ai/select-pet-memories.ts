import "server-only";

import { createClient } from "@/lib/supabase/server";

const MAX_CANDIDATE_MEMORIES = 80;
const MAX_SELECTED_MEMORIES = 8;
const MAX_CORE_MEMORIES = 4;
const MEMORY_CHAR_BUDGET = 1200;
const MIN_RELEVANCE_SCORE = 5;

type MemoryRow = {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  subject_user_id: string | null;
  updated_at: string;
};

export type SelectedPetMemory = {
  id: string;
  content: string;
  memoryType: string;
  importance: number;
  subjectUserId: string | null;
  subjectName: string;
};

const TYPE_HINTS: Record<string, string[]> = {
  preference: [
    "喜歡",
    "不喜歡",
    "討厭",
    "最愛",
    "偏好",
    "想吃",
    "吃什麼",
    "喝什麼",
    "口味",
    "想要",
  ],

  person_fact: [
    "生日",
    "名字",
    "幾歲",
    "年齡",
    "工作",
    "學校",
    "課程",
    "興趣",
    "住哪",
    "是誰",
    "星座",
  ],

  shared_memory: [
    "我們",
    "一起",
    "那次",
    "以前",
    "第一次",
    "去過",
    "回憶",
    "發生",
  ],

  temporary: [
    "今天",
    "明天",
    "昨天",
    "最近",
    "現在",
    "等等",
    "等一下",
    "這週",
    "下週",
  ],
};

const STOP_TERMS = new Set([
  "可以",
  "知道",
  "覺得",
  "真的",
  "這個",
  "那個",
  "什麼",
  "怎麼",
  "為什",
  "主人",
  "萌蛋",
  "你們",
  "我們",
  "我的",
  "你的",
  "記得",
  "喜歡",
]);

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function buildTerms(value: string) {
  const normalized = normalizeText(value);

  const terms = new Set<string>();

  /*
   * English / numbers.
   */
  const latinTerms = normalized.match(/[a-z0-9]{2,}/g) ?? [];

  for (const term of latinTerms) {
    if (!STOP_TERMS.has(term)) {
      terms.add(term);
    }
  }

  /*
   * Chinese text does not have spaces between
   * words, so generate 2- and 3-character grams.
   *
   * Example:
   *   "不喜歡香菜"
   *
   * becomes roughly:
   *   不喜 / 喜歡 / 歡香 / 香菜
   *   不喜歡 / 喜歡香 / 歡香菜
   */
  const hanRuns = normalized.match(/\p{Script=Han}+/gu) ?? [];

  for (const run of hanRuns) {
    for (const size of [2, 3]) {
      if (run.length < size) {
        continue;
      }

      for (let index = 0; index <= run.length - size; index += 1) {
        const term = run.slice(index, index + size);

        if (!STOP_TERMS.has(term)) {
          terms.add(term);
        }
      }
    }
  }

  return terms;
}

function getLexicalScore(queryTerms: Set<string>, memoryContent: string) {
  const memoryTerms = buildTerms(memoryContent);

  let score = 0;

  for (const term of memoryTerms) {
    if (!queryTerms.has(term)) {
      continue;
    }

    /*
     * 3-character matches are more specific
     * than 2-character matches.
     */
    score += term.length >= 3 ? 4 : 2;
  }

  return Math.min(score, 24);
}

function getTypeScore(memoryType: string, normalizedQuery: string) {
  const hints = TYPE_HINTS[memoryType] ?? [];

  return hints.some((hint) => normalizedQuery.includes(hint)) ? 6 : 0;
}

function getSubjectScore({
  subjectUserId,
  subjectName,
  currentUserId,
  normalizedQuery,
}: {
  subjectUserId: string | null;
  subjectName: string;
  currentUserId: string;
  normalizedQuery: string;
}) {
  const normalizedSubjectName = normalizeText(subjectName);

  /*
   * Explicitly mentioning a person's name is
   * the strongest subject signal.
   */
  if (
    normalizedSubjectName &&
    normalizedSubjectName !== "兩位主人共同" &&
    normalizedSubjectName !== "其中一位主人" &&
    normalizedQuery.includes(normalizedSubjectName)
  ) {
    return 10;
  }

  /*
   * "我 / 我的" usually refers to the currently
   * logged-in owner.
   */
  if (
    subjectUserId === currentUserId &&
    (normalizedQuery.includes("我") || normalizedQuery.includes("自己"))
  ) {
    return 4;
  }

  /*
   * Shared memories become more relevant when
   * the conversation talks about "us".
   */
  if (
    subjectUserId === null &&
    (normalizedQuery.includes("我們") || normalizedQuery.includes("一起"))
  ) {
    return 4;
  }

  return 0;
}

function getRecencyScore(updatedAt: string) {
  const timestamp = Date.parse(updatedAt);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageMs = Math.max(0, Date.now() - timestamp);

  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays <= 7) {
    return 3;
  }

  if (ageDays <= 30) {
    return 2;
  }

  if (ageDays <= 90) {
    return 1;
  }

  return 0;
}

function isRecallQuery(normalizedQuery: string) {
  return (
    normalizedQuery.includes("記得") ||
    normalizedQuery.includes("忘記") ||
    normalizedQuery.includes("知道我") ||
    normalizedQuery.includes("了解我")
  );
}

function scoreMemory({
  memory,
  queryTerms,
  normalizedQuery,
  currentUserId,
  subjectName,
}: {
  memory: MemoryRow;
  queryTerms: Set<string>;
  normalizedQuery: string;
  currentUserId: string;
  subjectName: string;
}) {
  const lexicalScore = getLexicalScore(queryTerms, memory.content);

  const typeScore = getTypeScore(memory.memory_type, normalizedQuery);

  const subjectScore = getSubjectScore({
    subjectUserId: memory.subject_user_id,
    subjectName,
    currentUserId,
    normalizedQuery,
  });

  let recallScore = 0;

  /*
   * If the owner explicitly asks what 萌蛋
   * remembers, allow stable memories to surface
   * even when there is no strong keyword match.
   */
  if (isRecallQuery(normalizedQuery)) {
    if (memory.subject_user_id === currentUserId) {
      recallScore = 3;
    } else if (memory.subject_user_id === null) {
      recallScore = 2;
    }
  }

  const relevance = lexicalScore + typeScore + subjectScore + recallScore;

  /*
   * importance alone must NOT make an unrelated
   * level-1/2 memory enter the prompt.
   */
  if (relevance === 0) {
    return 0;
  }

  const importanceScore = memory.importance === 2 ? 2 : 0;

  const recencyScore = getRecencyScore(memory.updated_at);

  return relevance + importanceScore + recencyScore;
}

export async function selectPetMemories({
  petId,
  currentUserId,
  query,
}: {
  petId: string;
  currentUserId: string;
  query: string;
}): Promise<SelectedPetMemory[]> {
  const supabase = await createClient();

  const now = new Date().toISOString();

  /*
   * Step 1:
   * Retrieve a reasonably small candidate pool.
   *
   * This is still cheap because the data stays
   * inside Supabase and is NOT sent to Gemini.
   */
  const { data, error } = await supabase
    .from("pet_memories")
    .select(
      `
        id,
        content,
        memory_type,
        importance,
        subject_user_id,
        updated_at
      `,
    )
    .eq("pet_id", petId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("importance", {
      ascending: false,
    })
    .order("updated_at", {
      ascending: false,
    })
    .limit(MAX_CANDIDATE_MEMORIES);

  if (error) {
    throw new Error(error.message);
  }

  const memories: MemoryRow[] = data ?? [];

  if (memories.length === 0) {
    return [];
  }

  /*
   * Resolve subject names so a query such as
   * "安喜歡吃什麼？" can match memories whose
   * subject_user_id belongs to 安.
   */
  const subjectIds = [
    ...new Set(
      memories
        .map((memory) => memory.subject_user_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const nameByUserId = new Map<string, string>();

  if (subjectIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", subjectIds);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    for (const profile of profiles ?? []) {
      nameByUserId.set(profile.id, profile.display_name);
    }
  }

  const normalizedQuery = normalizeText(query);

  const queryTerms = buildTerms(query);

  const scored = memories.map((memory) => {
    const subjectName =
      memory.subject_user_id === null
        ? "兩位主人共同"
        : (nameByUserId.get(memory.subject_user_id) ?? "其中一位主人");

    const score = scoreMemory({
      memory,
      queryTerms,
      normalizedQuery,
      currentUserId,
      subjectName,
    });

    return {
      memory,
      subjectName,
      score,
    };
  });

  /*
   * Level 3 = core memory.
   *
   * Keep a small number available even if the
   * current message does not contain matching
   * keywords.
   */
  const coreMemories = scored
    .filter(({ memory }) => memory.importance === 3)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return Date.parse(b.memory.updated_at) - Date.parse(a.memory.updated_at);
    })
    .slice(0, MAX_CORE_MEMORIES);

  /*
   * Level 1/2 must actually be relevant to the
   * current conversation.
   */
  const relevantMemories = scored
    .filter(
      ({ memory, score }) =>
        memory.importance < 3 && score >= MIN_RELEVANCE_SCORE,
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.memory.importance !== a.memory.importance) {
        return b.memory.importance - a.memory.importance;
      }

      return Date.parse(b.memory.updated_at) - Date.parse(a.memory.updated_at);
    })
    .slice(0, Math.max(0, MAX_SELECTED_MEMORIES - coreMemories.length));

  const selected = [...coreMemories, ...relevantMemories];

  /*
   * Final character budget.
   *
   * This prevents a future large memory database
   * from silently increasing Gemini input size.
   */
  const result: SelectedPetMemory[] = [];

  let usedCharacters = 0;

  for (const { memory, subjectName } of selected) {
    if (usedCharacters + memory.content.length > MEMORY_CHAR_BUDGET) {
      continue;
    }

    result.push({
      id: memory.id,
      content: memory.content,
      memoryType: memory.memory_type,
      importance: memory.importance,
      subjectUserId: memory.subject_user_id,
      subjectName,
    });

    usedCharacters += memory.content.length;

    if (result.length >= MAX_SELECTED_MEMORIES) {
      break;
    }
  }

  return result;
}
