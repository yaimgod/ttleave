import { z } from "zod";

export const submitAdjustmentSchema = z.object({
  reason_text: z
    .string()
    .min(3, "Describe what happened")
    .max(500, "Keep it under 500 characters"),
  days_chosen: z
    .number()
    .int()
    .min(0, "Must be 0 or more days")
    .max(365, "Max 365 days"),
});

export type SubmitAdjustmentInput = z.infer<typeof submitAdjustmentSchema>;
