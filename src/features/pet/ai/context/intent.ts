export type PendingTaskQueryScope =
  | "today"
  | "tomorrow"
  | "week"
  | "all"
  | "mutation";

const TODAY_TASK_PATTERNS = [
  /今天.*(?:要幹嘛|要幹麻|要做什麼|有什麼事|有什麼安排|有什麼要做)/,
  /今天.*(?:待辦|行程)/,
];

const TOMORROW_TASK_PATTERNS = [
  /明天.*(?:要幹嘛|要幹麻|要做什麼|有什麼事|有什麼安排|有什麼要做)/,
  /明天.*(?:待辦|行程)/,
];

const WEEK_TASK_PATTERNS = [
  /(?:這週|本週|這星期|本星期).*(?:要幹嘛|要幹麻|要做什麼|有什麼事|有什麼安排|有什麼要做)/,
  /(?:這週|本週|這星期|本星期).*(?:待辦|行程)/,
];

const ALL_TASK_CONTEXT_PATTERNS = [
  /待辦/,
  /我的事情/,
  /有什麼要做/,
  /還有什麼要做/,
  /有什麼安排/,
  /接下來.*(?:幹嘛|幹麻|做什麼|要做|安排)/,
  /最近.*(?:有什麼要做|有什麼事)/,
  /提醒我的/,
  /提醒事項/,
  /我的行程/,
];

const TASK_MUTATION_PATTERNS = [
  /做完了?/,
  /完成了?/,
  /弄好了?/,
  /買好了?/,
  /交了/,
  /繳了/,
  /取消/,
  /刪掉/,
  /不要記/,
  /不用做/,
  /不需要做/,
  /打錯/,
];

const RECENT_ACTIVITY_PATTERNS = [
  /剛剛.*(?:幹嘛|幹麻|做什麼|做啥|做了什麼|去哪|去了哪|在哪|在做什麼)/,
  /剛才.*(?:幹嘛|幹麻|做什麼|做啥|做了什麼|去哪|去了哪|在哪|在做什麼)/,
  /方才.*(?:幹嘛|幹麻|做什麼|做啥|做了什麼|去哪|去了哪|在哪|在做什麼)/,
];

export function getPendingTaskQueryScope(
  message: string,
): PendingTaskQueryScope | null {
  const normalized =
    message
      .trim()
      .toLowerCase();

  if (
    TOMORROW_TASK_PATTERNS.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "tomorrow";
  }

  if (
    TODAY_TASK_PATTERNS.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "today";
  }

  if (
    WEEK_TASK_PATTERNS.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "week";
  }

  if (
    ALL_TASK_CONTEXT_PATTERNS.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "all";
  }

  if (
    TASK_MUTATION_PATTERNS.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "mutation";
  }

  return null;
}

export function shouldLoadPendingTaskContext(
  message: string,
) {
  return (
    getPendingTaskQueryScope(
      message,
    ) !== null
  );
}

export function isRecentActivityQuestion(
  message: string,
) {
  const normalized =
    message
      .trim()
      .toLowerCase();

  return RECENT_ACTIVITY_PATTERNS.some(
    (pattern) =>
      pattern.test(normalized),
  );
}
