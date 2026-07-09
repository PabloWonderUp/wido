"use client";

import * as React from "react";

import { formatStopwatch } from "@/lib/utils";
import { playAlarm } from "@/lib/alarm";
import { useStopwatch } from "@/hooks/stopwatch-store";

const BASE_TITLE = "Wido";

/**
 * Mounted once in the layout. Reflects the running stopwatch in the browser
 * tab title (▶/⏸ + time next to the app name) and fires the goal alarm once
 * when the target is reached.
 */
export function StopwatchTitle() {
  const sw = useStopwatch();
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    // Fire the alarm once when the goal is first reached.
    if (sw.goalMs && sw.elapsedMs >= sw.goalMs) {
      if (!firedRef.current) {
        firedRef.current = true;
        if (sw.alarmEnabled) playAlarm();
      }
    } else {
      firedRef.current = false;
    }

    // Reflect the timer in the tab title.
    document.title = sw.hasTime
      ? `${sw.running ? "▶" : "⏸"} ${formatStopwatch(sw.elapsedMs)} · ${BASE_TITLE}`
      : BASE_TITLE;
  }, [sw.elapsedMs, sw.running, sw.hasTime, sw.goalMs, sw.alarmEnabled]);

  React.useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  return null;
}
