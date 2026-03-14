import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreText } from "@/lib/nlp/scorer";
import { scoreToSuggestedDays, scoreToBucketLabel } from "@/lib/nlp/suggester";

export const runtime = "edge";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
});

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

    const result = scoreText(parsed.data.text);
    const suggestedDays = scoreToSuggestedDays(result.normalizedScore);
    const bucket = scoreToBucketLabel(result.normalizedScore);

    return NextResponse.json({
      sentimentScore: result.normalizedScore,
      suggestedDays,
      bucket,
      matchedWords: result.matchedWords,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
