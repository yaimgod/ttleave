import { create } from "zustand";
import { getCountdownParts, type CountdownParts } from "@/lib/utils/countdown";

interface CountdownState {
  ticks: Record<string, CountdownParts>;
  startTicking: (eventId: string, targetDate: string) => () => void;
  stopTicking: (eventId: string) => void;
}

export const useCountdownStore = create<CountdownState>((set) => ({
  ticks: {},

  startTicking: (eventId, targetDate) => {
    let rafId: number;

    const tick = () => {
      set((state) => ({
        ticks: {
          ...state.ticks,
          [eventId]: getCountdownParts(targetDate),
        },
      }));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Return cleanup function
    return () => cancelAnimationFrame(rafId);
  },

  stopTicking: (eventId) => {
    set((state) => {
      const next = { ...state.ticks };
      delete next[eventId];
      return { ticks: next };
    });
  },
}));
