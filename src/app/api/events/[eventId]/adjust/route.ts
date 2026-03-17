import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { submitAdjustmentSchema } from "@/lib/validations/adjustment.schema";
import { scoreToBucketLabel } from "@/lib/nlp/suggester";
import { predict, updateModel, defaultLinearModel } from "@/lib/ml/adaptation";
import type { LinearModel } from "@/lib/ml/adaptation";
import { addDays } from "date-fns";
import { isValidUUID } from "@/lib/utils/uuid";

type DateAdjustmentInsert = Database["public"]["Tables"]["date_adjustments"]["Insert"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type NlpFeedbackInsert = Database["public"]["Tables"]["nlp_feedback"]["Insert"];
type Params = { params: { eventId: string } };

const NLP_URL = process.env.NLP_SERVICE_URL ?? "http://nlp:8080";

/**
 * Call the Python NLP sidecar.
 * Returns 0.5 (neutral/moderate) on failure so adjustments still work
 * even if the sidecar is temporarily unavailable.
 */
async function callNlpService(text: string): Promise<number> {
  try {
    const res = await fetch(`${NLP_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`nlp sidecar returned ${res.status}`);
    const data = (await res.json()) as { score: number };
    return data.score; // 0-1 float
  } catch {
    return 0.5; // fallback
  }
}

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

  // 2. Score via Python sidecar → 0-1 float
  const rawScore = await callNlpService(reason_text);
  const sentimentScore = Math.round(rawScore * 100); // 0-100 for DB audit log

  // 3. Fetch or initialise personal linear model
  const { data: feedbackRow } = await supabase
    .from("nlp_feedback")
    .select("lr_slope, lr_intercept, lr_learning_rate, sample_count")
    .eq("user_id", user.id)
    .eq("event_id", params.eventId)
    .single();

  const model: LinearModel = feedbackRow
    ? (feedbackRow as LinearModel)
    : defaultLinearModel();

  const adaptedSuggested = predict(model, rawScore);

  // 4. Calculate new date (days_chosen is the number of days to bring forward)
  const dateBefore = new Date(ev.target_date);
  const dateAfter = addDays(dateBefore, -days_chosen);

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

  // 6. Log the adjustment (sentiment_score stored as 0-100 integer per schema)
  const adjPayload: DateAdjustmentInsert = {
    event_id: params.eventId,
    user_id: user.id,
    reason_text,
    sentiment_score: sentimentScore,
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

  // 7. Online gradient descent update — learn from user's override
  const updatedModel = updateModel(model, rawScore, days_chosen);

  const nlpPayload: NlpFeedbackInsert = {
    user_id: user.id,
    event_id: params.eventId,
    lr_slope: updatedModel.lr_slope,
    lr_intercept: updatedModel.lr_intercept,
    lr_learning_rate: updatedModel.lr_learning_rate,
    sample_count: updatedModel.sample_count,
    last_updated: new Date().toISOString(),
  };
  await supabase
    .from("nlp_feedback")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase infers 'never' for upsert payload
    .upsert(nlpPayload as any);

  return NextResponse.json({
    adjustment,
    sentimentScore,
    bucket: scoreToBucketLabel(sentimentScore),
    suggestedDays: adaptedSuggested,
    newTargetDate: dateAfter.toISOString(),
  });
}

// GET — return score preview without saving (authenticated only)
export async function GET(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route signature requires params
  { params: _params }: Params
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") ?? "";
  if (!text) return NextResponse.json({ error: "Provide text param" }, { status: 400 });

  const rawScore = await callNlpService(text);
  const sentimentScore = Math.round(rawScore * 100);
  // GET preview uses cold-start base curve (no personal model applied for previews)
  const suggestedDays = predict(defaultLinearModel(), rawScore);

  return NextResponse.json({ sentimentScore, suggestedDays });
}
