import "server-only";

import { getTaipeiDateKey } from "@/lib/time/taipei-time";

export function getTaipeiToday() {
  return getTaipeiDateKey(Date.now());
}
