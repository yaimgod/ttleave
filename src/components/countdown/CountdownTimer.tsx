"use client";

import { useCountdownTick } from "@/hooks/useCountdownTick";
import { pad2 } from "@/lib/utils/countdown";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  eventId: string;
  targetDate: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CountdownTimer({
  eventId,
  targetDate,
  size = "md",
  className,
}: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdownTick(
    eventId,
    targetDate
  );

  if (isExpired) {
    return (
      <div className={cn("text-muted-foreground font-medium", className)}>
        Completed
      </div>
    );
  }

  const sizeClasses = {
    sm: { unit: "text-lg font-bold tabular-nums", label: "text-[10px]" },
    md: { unit: "text-3xl font-bold tabular-nums", label: "text-xs" },
    lg: { unit: "text-5xl font-bold tabular-nums", label: "text-sm" },
  };

  const { unit, label } = sizeClasses[size];

  return (
    <div className={cn("flex items-end gap-1", className)}>
      <UnitBlock value={days} label="days" unitClass={unit} labelClass={label} />
      <Colon unitClass={unit} />
      <UnitBlock value={hours} label="hrs" unitClass={unit} labelClass={label} />
      <Colon unitClass={unit} />
      <UnitBlock value={minutes} label="min" unitClass={unit} labelClass={label} />
      <Colon unitClass={unit} />
      <UnitBlock value={seconds} label="sec" unitClass={unit} labelClass={label} />
    </div>
  );
}

function UnitBlock({
  value,
  label,
  unitClass,
  labelClass,
}: {
  value: number;
  label: string;
  unitClass: string;
  labelClass: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={unitClass}>{pad2(value)}</span>
      <span className={cn(labelClass, "text-muted-foreground uppercase tracking-wide")}>
        {label}
      </span>
    </div>
  );
}

function Colon({ unitClass }: { unitClass: string }) {
  return (
    <span className={cn(unitClass, "pb-4 text-muted-foreground select-none")}>
      :
    </span>
  );
}
