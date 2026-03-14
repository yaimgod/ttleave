"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitAdjustmentSchema, type SubmitAdjustmentInput } from "@/lib/validations/adjustment.schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { scoreToBucketLabel } from "@/lib/nlp/suggester";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MutableEventInputProps {
  eventId: string;
  onAdjusted?: (newDate: string) => void;
}

interface ScorePreview {
  sentimentScore: number;
  suggestedDays: number;
  bucket: string;
}

const bucketColors: Record<string, string> = {
  calm: "bg-green-100 text-green-700 border-green-200",
  mild: "bg-yellow-100 text-yellow-700 border-yellow-200",
  stressed: "bg-orange-100 text-orange-700 border-orange-200",
  high: "bg-red-100 text-red-700 border-red-200",
  critical: "bg-red-200 text-red-900 border-red-300",
};

export function MutableEventInput({
  eventId,
  onAdjusted,
}: MutableEventInputProps) {
  const [preview, setPreview] = useState<ScorePreview | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<SubmitAdjustmentInput>({
    resolver: zodResolver(submitAdjustmentSchema),
    defaultValues: { reason_text: "", days_chosen: 0 },
  });

  const reasonText = form.watch("reason_text");

  // Live-preview NLP score as user types
  const scorePreview = async (text: string) => {
    if (text.length < 5) {
      setPreview(null);
      return;
    }
    const res = await fetch("/api/nlp/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      setPreview(data);
      form.setValue("days_chosen", data.suggestedDays);
    }
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
    toast.success(
      `Date moved up by ${values.days_chosen} day${values.days_chosen === 1 ? "" : "s"}`
    );
    form.reset();
    setPreview(null);
    onAdjusted?.(data.newTargetDate);
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="reason_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What happened?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Boss yelled at me during the meeting…"
                  className="resize-none"
                  rows={3}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    scorePreview(e.target.value);
                  }}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Describe a work event. We&apos;ll suggest how many days to advance your countdown.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Live NLP preview */}
        {preview && reasonText.length >= 5 && (
          <Alert className={cn("border", bucketColors[preview.bucket])}>
            <AlertDescription className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("capitalize", bucketColors[preview.bucket])}
                  >
                    {preview.bucket}
                  </Badge>
                  <span className="text-xs">
                    Stress score: {preview.sentimentScore}/100
                  </span>
                </div>
                <Progress value={preview.sentimentScore} className="h-1.5 w-32" />
              </div>
              <span className="text-sm font-medium whitespace-nowrap">
                Suggested: {preview.suggestedDays} day{preview.suggestedDays !== 1 ? "s" : ""}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {preview && (
          <FormField
            control={form.control}
            name="days_chosen"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Days to advance (edit to override)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Suggestion: {preview.suggestedDays} days. Your choice is saved to improve future suggestions.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={loading || !preview} className="w-full sm:w-auto">
          {loading ? "Adjusting…" : "Submit adjustment"}
        </Button>
      </form>
    </Form>
  );
}
