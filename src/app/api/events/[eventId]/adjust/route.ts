import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { submitAdjustmentSchema } from "@/lib/validations/adjustment.schema";
import { scoreText } from "@/lib/nlp/scorer";
import { scoreToSuggestedDays } from "@/lib/nlp/suggester";
import { updateEMA, adaptSuggestion, defaultFeedbackRecord } from "@/lib/ml/adaptation";
import { addDays } from "date-fns";
import { isValidUUID } from "@/lib/utils/uuid";

type DateAdjustmentInsert = Database["public"]["Tables"]["date_adjustments"]["Insert"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type NlpFeedbackInsert = Database["public"]["Tables"]["nlp_feedback"]["Insert"];
type Params = { params: { eventId: string } };

export async function POST(request: Request, { params }: Params) {
  if (!isValidUUID(params.eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = submitAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { reason_text, days_chosen } = parsed.data;

  // 1. Fetch the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const ev = event as EventRow;
  if (ev.event_type !== "mutable") {
    return NextResponse.json(
      { error: "Only mutable events can be adjusted" },
      { status: 400 }
    );
  }

  // 2. Score the input
  const scoreResult = scoreText(reason_text);
  const rawSuggested = scoreToSuggestedDays(scoreResult.normalizedScore);

  // 3. Fetch or initialize NLP feedback record
  const { data: feedbackRow } = await supabase
    .from("nlp_feedback")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_id", params.eventId)
    .single();

  const feedbackRecord = feedbackRow ?? {
    ...defaultFeedbackRecord(),
    user_id: user.id,
    event_id: params.eventId,
  };

  const adaptedSuggested = adaptSuggestion(rawSuggested, feedbackRecord);

  // 4. Calculate new date
  const dateBefore = new Date(ev.target_date);
  const dateAfter = addDays(dateBefore, -days_chosen); // advance = subtract days

  // 5. Update event target_date
  const eventUpdate: EventUpdate = {
    target_date: dateAfter.toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from("events")
    .update(eventUpdate as never)
    .eq("id", params.eventId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 6. Log the adjustment
  const adjPayload: DateAdjustmentInsert = {
    event_id: params.eventId,
    user_id: user.id,
    reason_text,
    sentiment_score: scoreResult.normalizedScore,
    days_suggested: adaptedSuggested,
    days_chosen,
    date_before: dateBefore.toISOString(),
    date_after: dateAfter.toISOString(),
  };
  const { data: adjustment, error: adjError } = await supabase
    .from("date_adjustments")
    .insert(adjPayload as never)
    .select()
    .single();

  if (adjError) {
    return NextResponse.json({ error: adjError.message }, { status: 500 });
  }

  // 7. Update EMA feedback
  const updatedRecord = updateEMA(feedbackRecord, adaptedSuggested, days_chosen);

  const nlpPayload: NlpFeedbackInsert = {
    user_id: user.id,
    event_id: params.eventId,
    ema_ratio: updatedRecord.ema_ratio,
    ema_alpha: updatedRecord.ema_alpha,
    sample_count: updatedRecord.sample_count,
    last_updated: new Date().toISOString(),
  };
  await supabase
    .from("nlp_feedback")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase infers 'never' for this table; payload is typed as NlpFeedbackInsert
    .upsert(nlpPayload as any);

  return NextResponse.json({
    adjustment,
    sentimentScore: scoreResult.normalizedScore,
    suggestedDays: adaptedSuggested,
    newTargetDate: dateAfter.toISOString(),
  });
}

// GET — return score preview without saving (authenticated only)
export async function GET(request: Request, { params: _params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") ?? "";
  if (!text) return NextResponse.json({ error: "Provide text param" }, { status: 400 });

  const result = scoreText(text);
  const suggested = scoreToSuggestedDays(result.normalizedScore);

  return NextResponse.json({
    sentimentScore: result.normalizedScore,
    suggestedDays: suggested,
    matchedWords: result.matchedWords,
  });
}
