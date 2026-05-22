import { spawnSync } from 'child_process';
import path from 'path';

import { z } from 'zod';

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'pptx', 'analyze_template.py');

const analyzeResultSchema = z.object({
  success: z.literal(true),
  layoutCount: z.number(),
  slideLayouts: z.array(
    z.object({
      index: z.number(),
      name: z.string(),
      placeholderCount: z.number(),
      placeholderTypes: z.array(z.number()),
    }),
  ),
  layouts: z.record(z.string(), z.number()),
  warnings: z.array(z.string()),
  exportTheme: z
    .object({
      accent: z.string(),
      title: z.string(),
      body: z.string(),
      muted: z.string(),
      slideBackground: z.string(),
      slideBackgroundEnd: z.string(),
    })
    .optional(),
});

const analyzeErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export type PptTemplateAnalysis = z.infer<typeof analyzeResultSchema>;

export function runPptTemplateAnalysis(
  pptxPath: string,
): { ok: true; data: PptTemplateAnalysis } | { ok: false; error: string } {
  const python = process.env.PPTX_PYTHON?.trim() || 'python3';
  const result = spawnSync(python, [SCRIPT_PATH, '--pptx', pptxPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });

  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim();

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  const lastLine =
    stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .at(-1) ?? '';

  if (!lastLine) {
    return {
      ok: false,
      error:
        stderr ||
        `Python 分析無輸出（exit ${result.status ?? 'unknown'}）。請安裝 skills/pptx/requirements.txt`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(lastLine);
  } catch {
    return { ok: false, error: 'Python 分析回傳非 JSON' };
  }

  const failure = analyzeErrorSchema.safeParse(parsed);
  if (failure.success) {
    return { ok: false, error: failure.data.error };
  }

  const success = analyzeResultSchema.safeParse(parsed);
  if (!success.success) {
    return { ok: false, error: success.error.message };
  }

  return { ok: true, data: success.data };
}
