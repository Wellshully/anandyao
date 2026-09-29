import type { PetTaskCandidate } from "@/features/pet/ai/pet-reply";

const TIME_ZONE =
  "Asia/Taipei";

const DAY_MS =
  24 * 60 * 60 * 1000;

type Clock = {
  hour: number;
  minute: number;
  second: number;
};

function getTaipeiDateKey(
  date: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Failed to resolve Taipei date.",
    );
  }

  return `${year}-${month}-${day}`;
}

function addDays(
  dateKey: string,
  days: number,
) {
  const timestamp =
    new Date(
      `${dateKey}T12:00:00+08:00`,
    ).getTime();

  return getTaipeiDateKey(
    new Date(
      timestamp +
        days * DAY_MS,
    ),
  );
}

function makeDateKey(
  year: number,
  month: number,
  day: number,
) {
  return [
    String(year).padStart(
      4,
      "0",
    ),
    String(month).padStart(
      2,
      "0",
    ),
    String(day).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function isValidDateKey(
  dateKey: string,
) {
  const date =
    new Date(
      `${dateKey}T12:00:00+08:00`,
    );

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return false;
  }

  return (
    getTaipeiDateKey(date) ===
    dateKey
  );
}

function getCurrentYear(
  now: Date,
) {
  return Number(
    getTaipeiDateKey(now)
      .slice(0, 4),
  );
}

function getTaipeiWeekdayIndex(
  dateKey: string,
) {
  /*
   * Monday = 0
   * ...
   * Sunday = 6
   */
  const jsDay =
    new Date(
      `${dateKey}T12:00:00+08:00`,
    ).getUTCDay();

  return (
    jsDay + 6
  ) % 7;
}

const WEEKDAY_INDEX:
  Record<string, number> = {
    一: 0,
    二: 1,
    三: 2,
    四: 3,
    五: 4,
    六: 5,
    日: 6,
    天: 6,
  };

function parseDateExpression(
  input: string,
  now: Date,
) {
  const text =
    input.normalize("NFKC");

  const today =
    getTaipeiDateKey(now);

  if (
    text.includes("後天")
  ) {
    return addDays(
      today,
      2,
    );
  }

  if (
    text.includes("明天")
  ) {
    return addDays(
      today,
      1,
    );
  }

  if (
    text.includes("今天")
  ) {
    return today;
  }

  /*
   * YYYY-MM-DD / YYYY/MM/DD
   */
  const fullDate =
    text.match(
      /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/,
    );

  if (fullDate) {
    const dateKey =
      makeDateKey(
        Number(fullDate[1]),
        Number(fullDate[2]),
        Number(fullDate[3]),
      );

    return isValidDateKey(
      dateKey,
    )
      ? dateKey
      : null;
  }

  /*
   * YYYY年M月D日
   */
  const chineseFullDate =
    text.match(
      /(20\d{2})年(\d{1,2})月(\d{1,2})日/,
    );

  if (chineseFullDate) {
    const dateKey =
      makeDateKey(
        Number(
          chineseFullDate[1],
        ),
        Number(
          chineseFullDate[2],
        ),
        Number(
          chineseFullDate[3],
        ),
      );

    return isValidDateKey(
      dateKey,
    )
      ? dateKey
      : null;
  }

  /*
   * M/D or M月D日.
   */
  const monthDay =
    text.match(
      /(?:^|[^\d])(\d{1,2})[\/.-](\d{1,2})(?:[^\d]|$)/,
    ) ??
    text.match(
      /(\d{1,2})月(\d{1,2})日/,
    );

  if (monthDay) {
    let year =
      getCurrentYear(now);

    let dateKey =
      makeDateKey(
        year,
        Number(monthDay[1]),
        Number(monthDay[2]),
      );

    if (
      !isValidDateKey(
        dateKey,
      )
    ) {
      return null;
    }

    /*
     * Pet task creation describes
     * something still relevant.
     *
     * 12/30 saying "1/2" therefore
     * means next year.
     */
    if (
      dateKey < today
    ) {
      year += 1;

      dateKey =
        makeDateKey(
          year,
          Number(monthDay[1]),
          Number(monthDay[2]),
        );
    }

    return dateKey;
  }

  /*
   * 這週五 / 下週四 / 星期三 / 週六
   */
  const weekday =
    text.match(
      /(下週|下星期|這週|本週|這星期|本星期)?(?:週|星期)([一二三四五六日天])/,
    );

  if (weekday) {
    const prefix =
      weekday[1] ?? "";

    const target =
      WEEKDAY_INDEX[
        weekday[2]
      ];

    const current =
      getTaipeiWeekdayIndex(
        today,
      );

    let delta =
      target - current;

    if (
      prefix === "下週" ||
      prefix === "下星期"
    ) {
      delta += 7;

      if (delta <= 0) {
        delta += 7;
      }
    } else if (
      prefix === "這週" ||
      prefix === "本週" ||
      prefix === "這星期" ||
      prefix === "本星期"
    ) {
      // Keep actual current-week meaning.
    } else if (
      delta < 0
    ) {
      delta += 7;
    }

    return addDays(
      today,
      delta,
    );
  }

  return null;
}

const DIGIT_MAP:
  Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    兩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

function parseNumber(
  value: string,
) {
  const input =
    value.trim();

  if (
    /^\d+$/.test(input)
  ) {
    return Number(input);
  }

  const normalized =
    input.replaceAll(
      "兩",
      "二",
    );

  if (
    normalized === "十"
  ) {
    return 10;
  }

  if (
    normalized.includes(
      "十",
    )
  ) {
    const [
      tensText,
      onesText,
    ] =
      normalized.split("十");

    const tens =
      tensText
        ? DIGIT_MAP[tensText]
        : 1;

    const ones =
      onesText
        ? DIGIT_MAP[onesText]
        : 0;

    if (
      tens === undefined ||
      ones === undefined
    ) {
      return null;
    }

    return (
      tens * 10 +
      ones
    );
  }

  const digits =
    [...normalized].map(
      (char) =>
        DIGIT_MAP[char],
    );

  if (
    digits.some(
      (digit) =>
        digit === undefined,
    )
  ) {
    return null;
  }

  return Number(
    digits.join(""),
  );
}

function applyDaypart(
  hour: number,
  daypart:
    string | undefined,
) {
  if (!daypart) {
    return hour;
  }

  if (
    daypart === "下午" ||
    daypart === "傍晚" ||
    daypart === "晚上" ||
    daypart === "晚間"
  ) {
    if (hour < 12) {
      return hour + 12;
    }
  }

  if (
    daypart === "中午" &&
    hour < 11
  ) {
    return hour + 12;
  }

  if (
    daypart === "凌晨" &&
    hour === 12
  ) {
    return 0;
  }

  return hour;
}

function parseExactClock(
  input: string,
): Clock | null {
  const text =
    input.normalize("NFKC");

  const colonMatch =
    text.match(
      /(凌晨|早上|上午|中午|下午|傍晚|晚上|晚間)?\s*(\d{1,2})[:：](\d{2})/,
    );

  if (colonMatch) {
    const hour =
      applyDaypart(
        Number(
          colonMatch[2],
        ),
        colonMatch[1],
      );

    const minute =
      Number(
        colonMatch[3],
      );

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return {
        hour,
        minute,
        second: 0,
      };
    }
  }

  const pointMatch =
    text.match(
      /(凌晨|早上|上午|中午|下午|傍晚|晚上|晚間)?\s*([0-9]{1,2}|[零〇一二兩三四五六七八九十]{1,3})\s*(?:點|時)(?:\s*([0-9]{1,2}|[零〇一二兩三四五六七八九十]{1,3})\s*分?|\s*(半))?/,
    );

  if (!pointMatch) {
    return null;
  }

  const rawHour =
    parseNumber(
      pointMatch[2],
    );

  if (
    rawHour === null
  ) {
    return null;
  }

  const hour =
    applyDaypart(
      rawHour,
      pointMatch[1],
    );

  let minute = 0;

  if (
    pointMatch[4] === "半"
  ) {
    minute = 30;
  } else if (
    pointMatch[3]
  ) {
    const parsedMinute =
      parseNumber(
        pointMatch[3],
      );

    if (
      parsedMinute === null
    ) {
      return null;
    }

    minute =
      parsedMinute;
  }

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
    second: 0,
  };
}

function parseDaypartEnd(
  input: string,
): Clock | null {
  const text =
    input.normalize("NFKC");

  if (
    /凌晨/u.test(text)
  ) {
    return {
      hour: 5,
      minute: 59,
      second: 59,
    };
  }

  if (
    /早上|上午/u.test(text)
  ) {
    return {
      hour: 11,
      minute: 59,
      second: 59,
    };
  }

  if (
    /中午/u.test(text)
  ) {
    return {
      hour: 13,
      minute: 59,
      second: 59,
    };
  }

  if (
    /下午|傍晚/u.test(text)
  ) {
    return {
      hour: 17,
      minute: 59,
      second: 59,
    };
  }

  if (
    /晚上|晚間/u.test(text)
  ) {
    return {
      hour: 23,
      minute: 59,
      second: 59,
    };
  }

  return null;
}

function toIso(
  dateKey: string,
  clock: Clock,
) {
  const hour =
    String(
      clock.hour,
    ).padStart(
      2,
      "0",
    );

  const minute =
    String(
      clock.minute,
    ).padStart(
      2,
      "0",
    );

  const second =
    String(
      clock.second,
    ).padStart(
      2,
      "0",
    );

  return new Date(
    `${dateKey}T${hour}:${minute}:${second}+08:00`,
  ).toISOString();
}

function getDueAtDateKey(
  dueAt: string | null,
) {
  if (!dueAt) {
    return null;
  }

  const parsed =
    new Date(dueAt);

  if (
    !Number.isFinite(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return getTaipeiDateKey(
    parsed,
  );
}

function normalizeFallbackDueAt(
  value: string | null,
  precision:
    PetTaskCandidate["timePrecision"],
) {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  if (
    precision === "date"
  ) {
    const match =
      trimmed.match(
        /^(\d{4}-\d{2}-\d{2})/,
      );

    if (!match) {
      return null;
    }

    return new Date(
      `${match[1]}T23:59:59+08:00`,
    ).toISOString();
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      trimmed,
    )
  ) {
    return new Date(
      `${trimmed}T23:59:59+08:00`,
    ).toISOString();
  }

  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      trimmed,
    );

  const candidate =
    hasTimezone
      ? trimmed
      : `${trimmed}+08:00`;

  const timestamp =
    Date.parse(candidate);

  if (
    Number.isNaN(timestamp)
  ) {
    return null;
  }

  return new Date(
    timestamp,
  ).toISOString();
}

export function resolvePetTaskDueAt(
  task: PetTaskCandidate,
  now = new Date(),
) {
  if (
    task.timePrecision ===
    "none"
  ) {
    return null;
  }

  const expression =
    task.timeExpression
      ?.trim() ?? "";

  const today =
    getTaipeiDateKey(now);

  const expressionDate =
    expression
      ? parseDateExpression(
          expression,
          now,
        )
      : null;

  const fallbackDate =
    getDueAtDateKey(
      task.dueAt,
    );

  /*
   * If the owner says only
   * "下午三點" or "晚上",
   * the natural date is today.
   */
  const implicitToday =
    expression &&
    (
      task.timePrecision ===
        "exact" ||
      task.timePrecision ===
        "daypart"
    )
      ? today
      : null;

  const dateKey =
    expressionDate ??
    implicitToday ??
    fallbackDate;

  if (
    task.timePrecision ===
    "exact"
  ) {
    const clock =
      parseExactClock(
        expression,
      );

    if (
      dateKey &&
      clock
    ) {
      return toIso(
        dateKey,
        clock,
      );
    }
  }

  if (
    task.timePrecision ===
    "daypart"
  ) {
    const clock =
      parseDaypartEnd(
        expression,
      );

    if (
      dateKey &&
      clock
    ) {
      return toIso(
        dateKey,
        clock,
      );
    }
  }

  if (
    task.timePrecision ===
      "date" &&
    dateKey
  ) {
    return toIso(
      dateKey,
      {
        hour: 23,
        minute: 59,
        second: 59,
      },
    );
  }

  /*
   * Backward compatibility:
   * old model output without timeExpression
   * can still use dueAt.
   */
  return normalizeFallbackDueAt(
    task.dueAt,
    task.timePrecision,
  );
}
