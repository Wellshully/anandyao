export function shouldRetryRecurringOccurrence({
  message,
  hasRecurringContext,
  actionCount,
}: {
  message: string;
  hasRecurringContext: boolean;
  actionCount: number;
}): boolean {
  if (!hasRecurringContext || actionCount > 0) {
    return false;
  }

  const text = message
    .normalize("NFKC")
    .replace(/\s+/gu, "");

  const hasMutation =
    /(?:改成|改到|改為|改在|換成|改時間|延後|提前|取消|恢復)/u.test(
      text,
    );

  const hasSpecificOccurrence =
    /(?:這|本|下)(?:週|周|星期|禮拜)[一二三四五六日天]/u.test(
      text,
    ) ||
    /(?:今天|明天|後天)/u.test(text) ||
    /\d{4}-\d{2}-\d{2}/u.test(text) ||
    /\d{1,2}\/\d{1,2}/u.test(text) ||
    /\d{1,2}月\d{1,2}日/u.test(text);

  const hasSeriesIntent =
    /(?:以後每|往後每|之後每|每週|每周|每星期|每禮拜|隔週|整個|全部|所有)/u.test(
      text,
    );

  return (
    hasMutation &&
    hasSpecificOccurrence &&
    !hasSeriesIntent
  );
}
