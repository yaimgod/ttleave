import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreToBucketLabel } from "@/lib/nlp/suggester";
import { predict, defaultVADModel } from "@/lib/ml/adaptation";
import type { VADModel, VADFeatures } from "@/lib/ml/adaptation";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";

// Needs Supabase server client (Node.js cookies API) — cannot use edge runtime
export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
  eventId: z.string().optional(),
});

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

/**
 * Call the Python NLP sidecar.
 * Returns null when the sidecar is unreachable so callers can distinguish
 * "genuinely neutral" (days=0 from real VAD) from "sidecar offline" (no data).
 */
async function callNlpService(text: string): Promise<NlpSidecarResponse | null> {
  try {
    const res = await fetch(`${NLP_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000), // 5 s hard timeout
    });
    if (!res.ok) throw new Error(`nlp sidecar returned ${res.status}`);
    const data = (await res.json()) as NlpSidecarResponse;
    // Guard against old sidecar (pre-VAD) that doesn't include vad field
    if (!data.vad) throw new Error("sidecar response missing vad field");
    return data;
  } catch {
    return null; // sidecar offline or wrong version — caller handles gracefully
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { text, eventId } = parsed.data;

    // 1. Score via Python sidecar → VAD features + composite score
    const nlp = await callNlpService(text);

    // Sidecar offline or old version — tell the client so it can hide the suggestion
    if (!nlp) {
      return NextResponse.json({ available: false });
    }

    const vad: VADFeatures = nlp.vad;

    // 2. Convert composite score to 0-100 integer for UI display and bucket label
    const sentimentScore = Math.round(nlp.score * 100);
    const bucket = scoreToBucketLabel(sentimentScore);

    // 3. Fetch user's personal 3-D VAD model if authenticated + eventId given
    let model: VADModel = defaultVADModel();
    if (eventId && isValidUUID(eventId)) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: row } = await supabase
          .from("nlp_feedback")
          .select("lr_w_v, lr_w_a, lr_w_d, lr_bias, lr_learning_rate, sample_count")
          .eq("user_id", user.id)
          .eq("event_id", eventId)
          .order("last_updated", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (row) model = row as VADModel;
      }
    }

    // 4. Predict days using personal model (base curve during cold start)
    const suggestedDays = predict(model, vad);

    return NextResponse.json({
      available: true,
      sentimentScore,
      suggestedDays,
      bucket,
      dominantEmotion: nlp.dominant_emotion,
      vad,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
