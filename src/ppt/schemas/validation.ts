import { z } from 'zod';

export const validationIssueSchema = z.object({
  code: z.string().min(1),
  slideIndex: z.number().int().min(1).optional(),
  field: z.string().optional(),
  message: z.string().min(1),
  suggestedAction: z.string().optional(),
});

export const pptxSkillResultSchema = z.object({
  success: z.boolean(),
  file_path: z.string().optional(),
  issues: z.array(validationIssueSchema),
  slide_count: z.number().int().min(0).optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type PptxSkillResult = z.infer<typeof pptxSkillResultSchema>;
