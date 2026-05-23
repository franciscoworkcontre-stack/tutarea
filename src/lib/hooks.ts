"use client";

import { useState, useEffect } from "react";

/**
 * Returns null on the server (and on first client render during hydration),
 * then updates to new Date() after mount.
 * Use this instead of new Date() in any render path to avoid hydration
 * mismatches caused by server UTC time vs client local time.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  return now;
}
