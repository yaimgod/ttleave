"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  Calendar,
  Users,
  Link2,
  Sparkles,
  ChevronRight,
  Copy,
  Clock,
  Smile,
} from "lucide-react";

/* ─── Step visual mockups ─────────────────────────────────────── */

function MockWelcome() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 pointer-events-none select-none">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Your countdowns</span>
        <div className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium">
          <Plus className="h-3 w-3" />
          New event
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: "Summer vacation", days: 38, color: "bg-blue-500" },
          { label: "Team offsite", days: 12, color: "bg-violet-500" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", item.color)} />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {item.days}d
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockNewEvent() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 pointer-events-none select-none">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        New event
      </p>
      <div className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          e.g. Summer vacation…
        </div>
        <div className="flex gap-2">
          {["Leave", "Trip", "Event"].map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs",
                t === "Leave"
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Pick a date
        </div>
      </div>
      <div className="flex justify-end">
        <div className="rounded-md bg-primary px-4 py-1.5 text-xs text-primary-foreground font-medium">
          Create
        </div>
      </div>
    </div>
  );
}

function MockGroup() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 pointer-events-none select-none">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Team Alpha</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          4 members
        </span>
      </div>
      <div className="rounded-lg border bg-muted/40 px-3 py-2 space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Invite link</p>
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono text-foreground truncate flex-1">
            ttleave.app/join/a1b2c3…
          </span>
          <div className="rounded border px-2 py-0.5 text-xs flex items-center gap-1 text-muted-foreground">
            <Copy className="h-3 w-3" />
            Copy
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Anyone with the link can join and see shared events.
      </p>
    </div>
  );
}

function MockAdjust() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 pointer-events-none select-none">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Summer vacation</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          38 days
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground italic">
        &ldquo;so tired, need a long break&rdquo;
      </div>
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground">AI suggestion</span>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div>
          <p className="text-xs font-medium">Bring closer</p>
          <p className="text-xs text-muted-foreground">You need a break 😤</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-primary">−5d</span>
          <ChevronRight className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <div className="rounded-md border px-3 py-1 text-xs text-muted-foreground">
          Dismiss
        </div>
        <div className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground font-medium">
          Apply
        </div>
      </div>
    </div>
  );
}

function MockDone() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 pointer-events-none select-none">
      <div className="flex items-center gap-2 mb-1">
        <Smile className="h-4 w-4 text-green-500" />
        <span className="text-sm font-semibold">You&apos;re all set!</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Calendar, label: "Create events", color: "text-blue-500" },
          { icon: Users, label: "Join groups", color: "text-violet-500" },
          { icon: Sparkles, label: "AI adjustments", color: "text-amber-500" },
          { icon: Clock, label: "Track countdowns", color: "text-green-500" },
        ].map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
            <span className="text-xs">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Revisit this guide anytime from your profile.
      </p>
    </div>
  );
}

/* ─── Steps config ────────────────────────────────────────────── */

const STEPS = [
  {
    title: "Welcome to TTLeave",
    description: "Track leave and vacation countdowns, share them with your team, and let AI adjust dates based on how you feel.",
    visual: <MockWelcome />,
  },
  {
    title: "Create a countdown",
    description: 'Click "New event" on the dashboard. Give it a name, pick a type, and set a target date — your countdown starts right away.',
    visual: <MockNewEvent />,
  },
  {
    title: "Share with your team",
    description: "Create a group, then copy the invite link and send it to teammates. Share any event to a group so everyone can follow along.",
    visual: <MockGroup />,
  },
  {
    title: "AI date adjustments",
    description: "On any event, describe how you're feeling. The AI reads your mood and suggests whether to bring the date closer or push it back.",
    visual: <MockAdjust />,
  },
  {
    title: "You're ready!",
    description: "Everything is set up. Explore your dashboard and start creating events.",
    visual: <MockDone />,
  },
];

/* ─── Modal ───────────────────────────────────────────────────── */

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
      setStep(0);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onComplete()}>
      <DialogContent className="max-w-md w-full gap-0 p-0 overflow-hidden">
        {/* Visual mockup */}
        <div className="bg-muted/40 border-b px-6 pt-6 pb-4">
          {current.visual}
        </div>

        {/* Text content */}
        <div className="px-6 pt-5 pb-4 space-y-1.5">
          <h2 className="text-base font-semibold">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>
        </div>

        <DialogFooter className="px-6 pb-5 flex-row items-center justify-between gap-2">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={onComplete}>
                Skip
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? "Get started" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
