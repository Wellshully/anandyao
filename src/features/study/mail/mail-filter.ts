export function shouldIgnoreNtuMail(subject: string | null | undefined) {
  const normalized = subject?.trim() ?? "";

  return normalized.startsWith("「校內訊息」");
}
