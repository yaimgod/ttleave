import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  event_type: z.enum(["set_date", "linked", "mutable"]),
  target_date: z.string().datetime({ message: "Select a valid date" }),
  group_id: z.string().uuid().optional().nullable(),
  member_permissions: z
    .enum(["view_only", "view_comment", "can_adjust"])
    .default("view_comment"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color")
    .default("#6366f1"),
});

export const updateEventSchema = createEventSchema.partial().omit({
  event_type: true,
});

export const createChainLinkSchema = z
  .object({
    successor_id: z.string().uuid("Select a valid event"),
    link_type: z.enum(["relative", "absolute"]),
    offset_days: z.number().int().min(1).optional(),
    absolute_start_date: z
      .string()
      .datetime()
      .optional()
      .nullable(),
    chain_name: z.string().max(80).optional(),
  })
  .refine(
    (d) =>
      d.link_type === "relative"
        ? d.offset_days !== undefined && d.offset_days > 0
        : d.absolute_start_date !== undefined,
    { message: "Provide offset days (relative) or start date (absolute)" }
  );

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateChainLinkInput = z.infer<typeof createChainLinkSchema>;
