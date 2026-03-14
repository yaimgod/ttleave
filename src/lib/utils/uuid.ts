import { z } from "zod";

const uuidSchema = z.string().uuid();

export function isValidUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
