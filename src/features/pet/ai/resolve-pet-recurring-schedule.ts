import { siteConfig } from "@/config/site";

export type ResolvedPetRecurringSchedule = {
  recurrenceRule: string;
  recurrenceStartDate: string;
  recurrenceEndDate: string | null;
  timePrecision:
    | "none"
    | "daypart"
    | "exact";
  startTime: string | null;
};

const WEEKDAY_TO_RRULE: Record<
  string,
  string
> = {
  一: "MO",
  二: "TU",
  三: "WE",
  四: "TH",
  五: "FR",
  六: "SA",
  日: "SU",
  天: "SU",
};

const RRULE_TO_JS_DAY: Record<
  string,
  number
> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const CHINESE_DIGITS: Record<
  string,
  number
> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function getTaipeiDateKey(
  date: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          siteConfig.timeZone,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      },
    ).formatToParts(
      date,
    );

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
      "Failed to calculate Taipei date.",
    );
  }

  return `${year}-${month}-${day}`;
}

function parseChineseInteger(
  raw: string,
) {
  const value =
    raw.trim();

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === "十") {
    return 10;
  }

  const tenMatch =
    /^([一二兩两三四五六七八九])?十([一二三四五六七八九])?$/.exec(
      value,
    );

  if (tenMatch) {
    const tens =
      tenMatch[1]
        ? CHINESE_DIGITS[
            tenMatch[1]
          ]
        : 1;

    const ones =
      tenMatch[2]
        ? CHINESE_DIGITS[
            tenMatch[2]
          ]
        : 0;

    return (
      tens * 10 +
      ones
    );
  }

  if (
    value.length === 1 &&
    CHINESE_DIGITS[
      value
    ] !== undefined
  ) {
    return CHINESE_DIGITS[
      value
    ];
  }

  return null;
}

function extractWeekdays(
  expression: string,
) {
  const result =
    new Set<string>();

  /*
   * Matches:
   *
   * 每週二跟五
   * 每週二、五
   * 每星期二和星期五
   * 隔週四
   * 每兩週星期四
   */
  const pattern =
    /(?:每|隔)?(?:週|周|星期|禮拜)([一二三四五六日天](?:[、，,\/和跟及與\s]*[一二三四五六日天])*)/g;

  for (
    const match of
      expression.matchAll(
        pattern,
      )
  ) {
    const group =
      match[1];

    for (
      const character of
        group
    ) {
      const weekday =
        WEEKDAY_TO_RRULE[
          character
        ];

      if (weekday) {
        result.add(
          weekday,
        );
      }
    }
  }

  /*
   * Also support:
   *
   * 每週二跟週五
   *
   * where the second weekday has
   * its own 週 prefix.
   */
  const standalone =
    /(?:週|周|星期|禮拜)([一二三四五六日天])/g;

  for (
    const match of
      expression.matchAll(
        standalone,
      )
  ) {
    const weekday =
      WEEKDAY_TO_RRULE[
        match[1]
      ];

    if (weekday) {
      result.add(
        weekday,
      );
    }
  }

  return Array.from(result);
}

function getInterval(
  expression: string,
) {
  if (
    /隔(?:週|周|星期)/.test(
      expression,
    ) ||
    /每(?:兩|两|二|2)(?:週|周|星期)/.test(
      expression,
    )
  ) {
    return 2;
  }

  return 1;
}

function parseExactTime(
  expression: string,
) {
  const colonMatch =
    /(?:凌晨|早上|上午|中午|下午|傍晚|晚上|晚間)?\s*(\d{1,2})[:：](\d{2})/.exec(
      expression,
    );

  if (colonMatch) {
    let hour =
      Number(
        colonMatch[1],
      );

    const minute =
      Number(
        colonMatch[2],
      );

    const prefix =
      colonMatch[0];

    if (
      /下午|傍晚|晚上|晚間/.test(
        prefix,
      ) &&
      hour < 12
    ) {
      hour += 12;
    }

    if (
      /凌晨/.test(
        prefix,
      ) &&
      hour === 12
    ) {
      hour = 0;
    }

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return {
        hour,
        minute,
      };
    }
  }

  const chineseMatch =
    /(?:凌晨|早上|上午|中午|下午|傍晚|晚上|晚間)?\s*([零〇一二兩两三四五六七八九十\d]{1,3})\s*[點点時时](?:\s*(半|[零〇一二兩两三四五六七八九十\d]{1,3})\s*分?)?/.exec(
      expression,
    );

  if (!chineseMatch) {
    return null;
  }

  let hour =
    parseChineseInteger(
      chineseMatch[1],
    );

  if (hour === null) {
    return null;
  }

  let minute = 0;

  if (
    chineseMatch[2] ===
    "半"
  ) {
    minute = 30;
  } else if (
    chineseMatch[2]
  ) {
    const parsedMinute =
      parseChineseInteger(
        chineseMatch[2],
      );

    if (
      parsedMinute ===
      null
    ) {
      return null;
    }

    minute =
      parsedMinute;
  }

  const prefix =
    chineseMatch[0];

  if (
    /下午|傍晚|晚上|晚間/.test(
      prefix,
    ) &&
    hour < 12
  ) {
    hour += 12;
  }

  if (
    /凌晨/.test(
      prefix,
    ) &&
    hour === 12
  ) {
    hour = 0;
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
  };
}

function hasDaypart(
  expression: string,
) {
  return /凌晨|早上|上午|中午|下午|傍晚|晚上|晚間/.test(
    expression,
  );
}

function formatTime(
  hour: number,
  minute: number,
) {
  return `${String(
    hour,
  ).padStart(
    2,
    "0",
  )}:${String(
    minute,
  ).padStart(
    2,
    "0",
  )}:00`;
}

function getFirstOccurrenceDate(
  weekdays: string[],
  now: Date,
) {
  const today =
    getTaipeiDateKey(
      now,
    );

  /*
   * Noon avoids DST / midnight edge cases.
   * Taiwan currently has no DST, but keeping
   * date arithmetic away from midnight is
   * still safer.
   */
  const todayDate =
    new Date(
      `${today}T12:00:00+08:00`,
    );

  const allowedDays =
    new Set(
      weekdays.map(
        (weekday) =>
          RRULE_TO_JS_DAY[
            weekday
          ],
      ),
    );

  for (
    let offset = 0;
    offset < 7;
    offset += 1
  ) {
    const candidate =
      new Date(
        todayDate.getTime() +
          offset *
            24 *
            60 *
            60 *
            1000,
      );

    if (
      allowedDays.has(
        candidate.getDay(),
      )
    ) {
      return getTaipeiDateKey(
        candidate,
      );
    }
  }

  throw new Error(
    "Failed to resolve recurring schedule start date.",
  );
}

export function resolvePetRecurringSchedule(
  expression: string,
  now = new Date(),
): ResolvedPetRecurringSchedule | null {
  const normalized =
    expression
      .normalize("NFKC")
      .trim();

  if (!normalized) {
    return null;
  }

  const weekdays =
    extractWeekdays(
      normalized,
    );

  if (
    weekdays.length === 0
  ) {
    return null;
  }

  const hasRecurringMarker =
    /每(?:週|周|星期|禮拜)|隔(?:週|周|星期|禮拜)|每(?:兩|两|二|2)(?:週|周|星期|禮拜)/.test(
      normalized,
    );

  if (
    !hasRecurringMarker
  ) {
    return null;
  }

  const interval =
    getInterval(
      normalized,
    );

  const exactTime =
    parseExactTime(
      normalized,
    );

  const timePrecision =
    exactTime
      ? "exact"
      : hasDaypart(
            normalized,
          )
        ? "daypart"
        : "none";

  const byDay =
    weekdays.join(
      ",",
    );

  const recurrenceRule =
    interval === 1
      ? `FREQ=WEEKLY;BYDAY=${byDay}`
      : `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`;

  return {
    recurrenceRule,

    recurrenceStartDate:
      getFirstOccurrenceDate(
        weekdays,
        now,
      ),

    recurrenceEndDate:
      null,

    timePrecision,

    startTime:
      exactTime
        ? formatTime(
            exactTime.hour,
            exactTime.minute,
          )
        : null,
  };
}
