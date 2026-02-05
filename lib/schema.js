import { z } from "zod";

export const CopilotResponseSchema = z.object({
  summary: z.string().min(1).max(1200),
  key_drivers: z.array(z.string().min(1)).min(3).max(6),
  recommended_actions: z
    .array(
      z.object({
        action: z.string().min(1).max(240),
        reason: z.string().min(1).max(600),
        priority: z.enum(["high", "medium", "low"]),
      })
    )
    .min(3)
    .max(6),
  confidence: z.number().min(0).max(1),
  used_data_points: z.array(z.string().min(1)).min(1).max(16),
});

export const COPILOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1 },
    key_drivers: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string", minLength: 1 },
    },
    recommended_actions: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", minLength: 1 },
          reason: { type: "string", minLength: 1 },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["action", "reason", "priority"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    used_data_points: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: { type: "string", minLength: 1 },
    },
  },
  required: [
    "summary",
    "key_drivers",
    "recommended_actions",
    "confidence",
    "used_data_points",
  ],
};

export function validateCopilotResponse(payload) {
  const parsed = CopilotResponseSchema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data, error: null };
  return { ok: false, data: null, error: parsed.error };
}
