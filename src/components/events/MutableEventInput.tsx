"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  submitAdjustmentSchema,
  type SubmitAdjustmentInput,
} from "@/lib/validations/adjustment.schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCheck, Pencil } from "lucide-react";

interface MutableEventInputProps {
  eventId: string;
  onAdjusted?: (newDate: string) => void;
}

interface ScorePreview {
  sentimentScore: number;
  suggestedDays: number;
  bucket: string;
}

const bucketMeta: Record<string, { color: string; label: string }> = {
  calm:     { color: "bg-green-100 text-green-700 border-green-200",    label: "Calm" },
  mild:     { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Mild" },
  stressed: { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Stressed" },
  high:     { color: "bg-red-100 text-red-700 border-red-200",          label: "High stress" },
  critical: { color: "bg-red-200 text-red-900 border-red-300",          label: "Critical" },
};

/** Action label for the submit button (+/- aware). */
function daysLabel(days: number): string {
  const abs = Math.abs(days);
  const plural = abs === 1 ? "" : "s";
  if (days > 0) return `Move date up by ${abs} day${plural}`;
  if (days < 0) return `Push date back by ${abs} day${plural}`;
  return "Set days to submit";
}

/** Toast message after submission (+/- aware). */
function toastLabel(days: number): string {
  const abs = Math.abs(days);
  const plural = abs === 1 ? "" : "s";
  if (days > 0) return `Countdown moved up by ${abs} day${plural}`;
  if (days < 0) return `Countdown pushed back by ${abs} day${plural}`;
  return "No change made";
}

/** Signed display string for a day count. */
function signedDays(days: number): string {
  return days > 0 ? `+${days}d` : `${days}d`;
}

export function MutableEventInput({ eventId, onAdjusted }: MutableEventInputProps) {
  const [preview, setPreview] = useState<ScorePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingDays, setEditingDays] = useState(false);
  // Track whether user manually overrode the suggestion
  const [manualDays, setManualDays] = useState<number | null>(null);
  const daysInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<SubmitAdjustmentInput>({
    resolver: zodResolver(submitAdjustmentSchema),
    defaultValues: { reason_text: "", days_chosen: 0 },
  });

  const reasonText = form.watch("reason_text");

  // The days displayed: manual override takes priority, else NLP suggestion
  const displayDays = manualDays !== null ? manualDays : (preview?.suggestedDays ?? 0);

  const schedulePreview = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 5) {
      setPreview(null);
      setManualDays(null);
      form.setValue("days_chosen", 0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/nlp/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, eventId }),
        });
        if (!res.ok) return;
        const data: ScorePreview = await res.json();
        setPreview(data);
        // Only update form value if user hasn't manually overridden
        if (manualDays === null) {
          form.setValue("days_chosen", data.suggestedDays, { shouldValidate: true });
        }
      } catch {
        // network error — silently skip preview
      }
    }, 400);
  };

  const startEditing = () => {
    setEditingDays(true);
    setTimeout(() => daysInputRef.current?.select(), 30);
  };

  const commitEdit = (val: number) => {
    const clamped = Math.max(-365, Math.min(365, val));
    setManualDays(clamped);
    form.setValue("days_chosen", clamped, { shouldValidate: true });
    setEditingDays(false);
  };

  const claimSuggested = () => {
    if (!preview) return;
    setManualDays(null);
    form.setValue("days_chosen", preview.suggestedDays, { shouldValidate: true });
    setEditingDays(false);
  };

  async function onSubmit(values: SubmitAdjustmentInput) {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Failed to submit adjustment");
      setLoading(false);
      return;
    }

    const data = await res.json();
    toast.success(toastLabel(values.days_chosen));
    form.reset();
    setPreview(null);
    setManualDays(null);
    setEditingDays(false);
    onAdjusted?.(data.newTargetDate);
    setLoading(false);
  }

  const meta = preview ? (bucketMeta[preview.bucket] ?? bucketMeta.calm) : null;
  const isOverride = manualDays !== null && preview !== null && manualDays !== preview.suggestedDays;

  const dayInputEl = (defaultVal: number) => (
    editingDays ? (
      <input
        ref={daysInputRef}
        type="number"
        min={-365}
        max={365}
        defaultValue={defaultVal}
        className={cn(
          "w-16 rounded border px-1.5 py-0.5 text-sm font-semibold text-center",
          "bg-white/70 focus:outline-none focus:ring-1 focus:ring-current"
        )}
        onBlur={(e) => commitEdit(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit(Number((e.target as HTMLInputElement).value));
          if (e.key === "Escape") setEditingDays(false);
        }}
      />
    ) : (
      <button
        type="button"
        onClick={startEditing}
        className={cn(
          "flex items-center gap-1 rounded border px-2 py-0.5 text-sm font-semibold",
          "bg-white/50 hover:bg-white/80 transition-colors cursor-pointer",
          isOverride && "ring-1 ring-current"
        )}
        title="Click to override"
      >
        {signedDays(displayDays)}
        <Pencil className="h-3 w-3 opacity-60" />
      </button>
    )
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="reason_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">How are you feeling about this date?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Had a stressful sprint review… or everything is going great, no rush!"
                  className="resize-none text-sm"
                  rows={3}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    schedulePreview(e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Score preview — shown once text is long enough */}
        {preview && reasonText.length >= 5 && (
          <div className={cn("rounded-lg border p-3 space-y-2", meta?.color)}>

            {/* Mood level row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs capitalize border", meta?.color)}>
                  {meta?.label}
                </Badge>
                <span className="text-xs opacity-75">{preview.sentimentScore}/100</span>
              </div>
              <Progress value={preview.sentimentScore} className="h-1.5 w-24 shrink-0" />
            </div>

            {/* Days row */}
            {preview.suggestedDays === 0 ? (
              // Neutral — no change suggested, but allow manual override
              <p className="text-xs opacity-75">
                Feeling neutral — no date change suggested. Override below if you want one.
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">
                  {preview.suggestedDays > 0 ? "Bring closer (you need a break 😤):" : "Push further (you're doing well 😊):"}
                </span>

                {dayInputEl(displayDays)}

                {/* Show original suggestion when overriding */}
                {isOverride && (
                  <>
                    <span className="text-[10px] opacity-70">
                      (suggested {signedDays(preview.suggestedDays)})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-6 px-2 text-xs border gap-1", meta?.color)}
                      onClick={claimSuggested}
                    >
                      <CheckCheck className="h-3 w-3" />
                      Use {signedDays(preview.suggestedDays)}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Manual override when suggestion is exactly 0 */}
            {preview.suggestedDays === 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Days anyway:</span>
                {dayInputEl(displayDays)}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={loading || displayDays === 0}
                className="h-7 text-xs"
              >
                {loading ? "Saving…" : daysLabel(displayDays)}
              </Button>
            </div>
          </div>
        )}

        {!preview && (
          <p className="text-xs text-muted-foreground">
            Keep typing — we&apos;ll read the mood and suggest whether to bring the date closer or push it back.
          </p>
        )}
      </form>
    </Form>
  );
}
