const TASK_CONTEXT_PHRASES = [
  "待辦",
  "我的事情",
  "有什麼要做",
  "還有什麼要做",
  "今天要幹嘛",
  "今天要幹麻",
  "今天要做什麼",
  "明天要幹嘛",
  "明天要幹麻",
  "明天要做什麼",
  "提醒我的",
  "提醒事項",
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

export function shouldLoadPendingTaskContext(
  message: string,
) {
  const normalized =
    message.trim().toLowerCase();

  if (
    TASK_CONTEXT_PHRASES.some(
      (phrase) =>
        normalized.includes(phrase),
    )
  ) {
    return true;
  }

  return TASK_MUTATION_PATTERNS.some(
    (pattern) =>
      pattern.test(normalized),
  );
}

export function isRecentActivityQuestion(
  message: string,
) {
  const normalized =
    message.trim().toLowerCase();

  return RECENT_ACTIVITY_PATTERNS.some(
    (pattern) =>
      pattern.test(normalized),
  );
}
