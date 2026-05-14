import { z } from "zod";

const cursorSchema = z.object({
  line: z.number().int().min(0),
  column: z.number().int().min(0)
});

const selectionSchema = z.object({
  anchor: cursorSchema,
  head: cursorSchema
});

export const joinPayloadSchema = z.object({
  roomId: z.string().min(1),
  documentId: z.string().min(1)
});

export const documentUpdatePayloadSchema = joinPayloadSchema.extend({
  update: z.union([
    z.instanceof(Uint8Array),
    z.array(z.number().int().min(0).max(255)),
    z.string().min(1)
  ])
});

export const documentSavePayloadSchema = z.object({
  documentId: z.string().min(1)
});

export const presenceUpdatePayloadSchema = z.object({
  cursor: cursorSchema.optional(),
  selection: selectionSchema.optional(),
  typing: z.boolean().optional()
});

export const versionCreatePayloadSchema = z.object({
  documentId: z.string().min(1)
});

export function parseSocketPayload<T>(schema: z.ZodType<T>, payload: unknown) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error("Invalid WebSocket payload");
  }
  return result.data;
}
