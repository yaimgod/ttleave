import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreToBucketLabel } from "@/lib/nlp/suggester";
import { predict, defaultLinearModel } from "@/lib/ml/adaptation";
import type { LinearModel } from "@/lib/ml/adaptation";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";

// Needs Supabase server client (Node.js cookies API) — cannot use edge runtime
export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
  eventId: z.string().optional(),
});

const NLP_URL = process.env.NLP_SERVICE_URL ?? "http://nlp:8080";

/**
 * Call the Python NLP sidecar and return a 0-1 negativity float.
 * Falls back to 0.5 (moderate) if the sidecar is unreachable so the app
 * never crashes due to an unavailable ML service.
 */
async function callNlpService(
  text: string
): Promise<{ score: number; label: string }> {
  try {
    const res = await fetch(`${NLP_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000), // 5 s hard timeout
    });
    if (!res.ok) throw new Error(`nlp sidecar returned ${res.status}`);
    return (await res.json()) as { score: number; label: string };
  } catch {
    // Graceful degradation — return a mid-range score rather than crashing
    return { score: 0.5, label: "neutral" };
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

    // 1. Score via Python sidecar → 0-1 float
    const { score: rawScore } = await callNlpService(text);

    // 2. Convert to 0-100 integer for UI display and bucket labelling
    const sentimentScore = Math.round(rawScore * 100);
    const bucket = scoreToBucketLabel(sentimentScore);

    // 3. Fetch user's personal linear model if authenticated + eventId given
    let model: LinearModel = defaultLinearModel();
    if (eventId && isValidUUID(eventId)) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: row } = await supabase
          .from("nlp_feedback")
          .select("lr_slope, lr_intercept, lr_learning_rate, sample_count")
          .eq("user_id", user.id)
          .eq("event_id", eventId)
          .single();
        if (row) model = row as LinearModel;
      }
    }

    // 4. Predict days using personal model (base curve during cold start)
    const suggestedDays = predict(model, rawScore);

    return NextResponse.json({ sentimentScore, suggestedDays, bucket });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
