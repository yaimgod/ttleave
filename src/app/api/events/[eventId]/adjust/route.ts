import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { submitAdjustmentSchema } from "@/lib/validations/adjustment.schema";
import { scoreToBucketLabel } from "@/lib/nlp/suggester";
import { predict, updateModel, defaultVADModel } from "@/lib/ml/adaptation";
import type { VADModel, VADFeatures } from "@/lib/ml/adaptation";
import { addDays } from "date-fns";
import { isValidUUID } from "@/lib/utils/uuid";

type DateAdjustmentInsert = Database["public"]["Tables"]["date_adjustments"]["Insert"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type NlpFeedbackInsert = Database["public"]["Tables"]["nlp_feedback"]["Insert"];
type Params = { params: { eventId: string } };

const NLP_URL = process.env.NLP_SERVICE_URL ?? "http://nlp:8080";

/** Shape returned by the Python sidecar (v3 VAD model). */
interface NlpSidecarResponse {
  score: number;
  dominant_emotion: string;
  emotion_probs: Record<string, number>;
  vad: { V: number; A: number; D: number };
  language: string;
  translated: boolean;
}

/** Neutral fallback used when the sidecar is offline, for /adjust submission only. */
const FALLBACK_NLP: NlpSidecarResponse = {
  score: 0.5,
  dominant_emotion: "neutral",
  emotion_probs: { neutral: 1 },
  vad: { V: 0, A: 0, D: 0 },
  language: "en",
  translated: false,
};

/**
 * Call the Python NLP sidecar.
 * Returns null when the sidecar is unreachable so preview callers can show
 * "unavailable". For /adjust submissions we fall back to neutral VAD so
 * the user's chosen days are still recorded even without a live sidecar.
 */
async function callNlpService(
  text: string,
  { allowFallback }: { allowFallback: boolean } = { allowFallback: false }
): Promise<NlpSidecarResponse | null> {
  try {
    const res = await fetch(`${NLP_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`nlp sidecar returned ${res.status}`);
    const data = (await res.json()) as NlpSidecarResponse;
    if (!data.vad) throw new Error("sidecar response missing vad field");
    return data;
  } catch {
    return allowFallback ? FALLBACK_NLP : null;
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

  // 2. Score via Python sidecar → VAD features + composite score
  // allowFallback: true — if sidecar is down, record neutral VAD so
  // the date adjustment still goes through with the user's chosen days.
  const nlp = (await callNlpService(reason_text, { allowFallback: true }))!;
  const vad: VADFeatures = nlp.vad;
  const sentimentScore = Math.round(nlp.score * 100); // 0-100 for DB audit log

  // 3. Fetch or initialise personal 3-D VAD model
  const { data: feedbackRow } = await supabase
    .from("nlp_feedback")
    .select("lr_w_v, lr_w_a, lr_w_d, lr_bias, lr_learning_rate, sample_count")
    .eq("user_id", user.id)
    .eq("event_id", params.eventId)
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();

  const model: VADModel = feedbackRow
    ? (feedbackRow as VADModel)
    : defaultVADModel();

  const adaptedSuggested = predict(model, vad);

  // 4. Calculate new date (days_chosen is how many days to bring forward)
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
    vad_v: nlp.vad.V,
  } as DateAdjustmentInsert;
  const { data: adjustment, error: adjError } = await supabase
    .from("date_adjustments")
    .insert(adjPayload as never)
    .select()
    .single();

  if (adjError) {
    return NextResponse.json({ error: adjError.message }, { status: 500 });
  }

  // 7. Online gradient descent update — learn from user's override
  const updatedModel = updateModel(model, vad, days_chosen);

  const nlpPayload: NlpFeedbackInsert = {
    user_id: user.id,
    event_id: params.eventId,
    lr_w_v: updatedModel.lr_w_v,
    lr_w_a: updatedModel.lr_w_a,
    lr_w_d: updatedModel.lr_w_d,
    lr_bias: updatedModel.lr_bias,
    lr_learning_rate: updatedModel.lr_learning_rate,
    sample_count: updatedModel.sample_count,
    last_updated: new Date().toISOString(),
  } as NlpFeedbackInsert;

  await supabase
    .from("nlp_feedback")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase infers 'never' for upsert payload
    // onConflict targets the UNIQUE(user_id, event_id) constraint
    .upsert(nlpPayload as any, { onConflict: "user_id,event_id" });

  return NextResponse.json({
    adjustment,
    sentimentScore,
    bucket: scoreToBucketLabel(sentimentScore),
    suggestedDays: adaptedSuggested,
    dominantEmotion: nlp.dominant_emotion,
    vad,
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

  const nlp = await callNlpService(text);
  if (!nlp) return NextResponse.json({ available: false });
  const sentimentScore = Math.round(nlp.score * 100);
  // GET preview uses cold-start base curve (no personal model for previews)
  const suggestedDays = predict(defaultVADModel(), nlp.vad);

  return NextResponse.json({
    sentimentScore,
    suggestedDays,
    dominantEmotion: nlp.dominant_emotion,
    vad: nlp.vad,
  });
}
