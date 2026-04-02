"use client";
import { useState } from "react";
import { OnboardingModal } from "./OnboardingModal";

interface Props {
  initialCompleted: boolean;
}

export function OnboardingWrapper({ initialCompleted }: Props) {
  const [open, setOpen] = useState(!initialCompleted);

  const handleComplete = async () => {
    setOpen(false);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_completed: true }),
    });
  };

  return <OnboardingModal open={open} onComplete={handleComplete} />;
}
