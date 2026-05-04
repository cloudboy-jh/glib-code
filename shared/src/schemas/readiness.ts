import { z } from "zod";

const checkSchema = z.object({
  ok: z.boolean(),
  version: z.string().optional(),
  error: z.string().optional(),
  providers: z.array(z.string()).optional()
});

export const readinessReportSchema = z.object({
  ok: z.boolean(),
  checks: z.object({
    git: checkSchema,
    pi: checkSchema,
    gh: checkSchema
  })
});

export type ReadinessReport = z.infer<typeof readinessReportSchema>;
