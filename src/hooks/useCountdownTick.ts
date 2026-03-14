"use client";

import { useEffect } from "react";
import { useCountdownStore } from "@/store/countdownStore";
import type { CountdownParts } from "@/lib/utils/countdown";

/**
 * Subscribe to a live countdown for a given event.
 * Uses requestAnimationFrame via the Zustand countdownStore.
 */
export function useCountdownTick(
  eventId: string,
  targetDate: string
): CountdownParts {
  const startTicking = useCountdownStore((s) => s.startTicking);
  const stopTicking = useCountdownStore((s) => s.stopTicking);
  const parts = useCountdownStore((s) => s.ticks[eventId]);

  useEffect(() => {
    const stop = startTicking(eventId, targetDate);
    return () => {
      stop();
      stopTicking(eventId);
    };
  }, [eventId, targetDate, startTicking, stopTicking]);

  return (
    parts ?? {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
    }
  );
}
