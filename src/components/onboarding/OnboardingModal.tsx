"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    emoji: "👋",
    title: "Welcome to TTLeave",
    description:
      "TTLeave helps you track leave and vacation countdowns, share them with your team, and adjust dates based on how you're feeling.",
  },
  {
    emoji: "⏱️",
    title: "Create your first countdown",
    description:
      "Head to the dashboard and click 'New event'. Set a title, event type, and target date. Your countdown starts immediately.",
  },
  {
    emoji: "👥",
    title: "Share with your team",
    description:
      "Create a group and invite teammates with a link. Share any event to a group so everyone can track it together.",
  },
  {
    emoji: "🧠",
    title: "Smart date adjustments",
    description:
      "On any event, describe how you're feeling. Our AI reads your mood and suggests whether to bring the date closer or push it back — and learns your preferences over time.",
  },
  {
    emoji: "🎉",
    title: "You're all set!",
    description:
      "Explore your dashboard, create events, and join groups. You can always revisit this guide from your profile settings.",
  },
];

interface Props {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ open, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg w-full"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <DialogHeader className="text-center items-center">
          <div className="text-5xl mb-2">{current.emoji}</div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-sm text-center mt-1">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between mt-4">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={onComplete}>
                Skip
              </Button>
            )}
          </div>
          <Button onClick={next}>{isLast ? "Get started" : "Next"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
