import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  description: z.string().max(300).optional(),
});

export const updateGroupSchema = createGroupSchema.partial().extend({
  default_member_permissions: z
    .enum(["view_only", "view_comment", "can_adjust"])
    .optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
