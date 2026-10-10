type NextUpTarget = {
  kind: string;
  href: string | null;
} | null;

export function getHomeNextUpHref(
  item: NextUpTarget,
): string {
  if (item?.kind === "date") {
    return item.href?.startsWith("/dates/")
      ? item.href
      : "/dates";
  }

  if (item?.kind === "study") {
    return item.href?.startsWith("/study/")
      ? item.href
      : "/study";
  }

  // Pet Tasks, recurring schedules, Google,
  // and the existing fallback remain Calendar.
  // Personal will use its own panel action
  // once the actual panel control is identified.
  return "/calendar";
}

export function getHomeNextUpActionLabel(
  item: NextUpTarget,
): string {
  if (item?.kind === "date") {
    return "打開 Date →";
  }

  if (item?.kind === "study") {
    return "打開 Study →";
  }

  if (item?.kind === "personal") {
    return "展開今天的小計畫 →";
  }

  return "打開 Calendar →";
}
