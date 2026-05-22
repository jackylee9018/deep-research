import { existsSync } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { pptLog, pptLogError, pptLogWarn } from '../log';
import { deckPlanSchema, type DeckPlan } from '../schemas';
import type { PptxSkillResult } from '../schemas/validation';
import { runPptxSkill } from '../skill/run-pptx-skill';
import {
  resolvePptTemplate,
  resolvePptTemplatePath,
  useTemplateLayoutExport,
} from '../templates/registry';
import { getPptxExportBackend } from './export-backend';
import { renderDeckToPptx } from './pptxgen/render-deck';
import { validateDeckPlan } from './validate-deck-plan';

type RunPptExportOptions =
  | {
      action: 'generate';
      plan: DeckPlan;
      outputPath?: string;
      templatePath?: string;
    }
  | {
      action: 'validate';
      plan: DeckPlan;
    };

async function runNodeGenerate(
  plan: DeckPlan,
  outputPath: string,
): Promise<PptxSkillResult> {
  const issues = validateDeckPlan(plan);
  if (issues.length) {
    pptLog(`Node 匯出驗證失敗：${issues.length} 個 issue`);
    return {
      success: false,
      issues,
      slide_count: plan.slides.length,
    };
  }

  try {
    const templateEntry = resolvePptTemplate(plan.templateId);
    const { slideCount } = await renderDeckToPptx(
      plan,
      outputPath,
      templateEntry?.exportTheme,
    );
    pptLog(`Node 匯出完成：${slideCount} 頁 → ${outputPath}`);
    return {
      success: true,
      file_path: outputPath,
      issues: [],
      slide_count: slideCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pptLogError('Node PPTX 匯出失敗：', message);
    return {
      success: false,
      issues: [
        {
          code: 'skill_error',
          message,
          suggestedAction: 'Retry generation or switch PPTX_EXPORT_BACKEND=python.',
        },
      ],
      slide_count: plan.slides.length,
    };
  }
}

async function runPythonTemplateGenerate(
  plan: DeckPlan,
  outputPath: string,
  templatePath: string,
): Promise<PptxSkillResult> {
  return runPptxSkill({
    action: 'generate',
    plan,
    outputPath,
    templatePath,
  });
}

async function runNodeValidate(plan: DeckPlan): Promise<PptxSkillResult> {
  const issues = validateDeckPlan(plan);
  return {
    success: issues.length === 0,
    issues,
    slide_count: plan.slides.length,
  };
}

export async function runPptExport(
  options: RunPptExportOptions,
): Promise<PptxSkillResult> {
  const plan = deckPlanSchema.parse(options.plan);

  if (options.action === 'validate') {
    const backend = getPptxExportBackend();
    if (backend === 'python') {
      return runPptxSkill({ action: 'validate', plan });
    }
    return runNodeValidate(plan);
  }

  const outputPath =
    options.outputPath ??
    path.join(
      await mkdtemp(path.join(tmpdir(), 'deep-research-ppt-')),
      'deck.pptx',
    );

  const templatePath =
    options.templatePath ?? resolvePptTemplatePath(plan.templateId);
  const templateReady = existsSync(templatePath);

  if (useTemplateLayoutExport() && templateReady) {
    pptLog(
      `PPTX 匯出：模板版式｜${plan.templateId ?? 'default'}｜${templatePath}`,
    );
    try {
      const result = await runPythonTemplateGenerate(
        plan,
        outputPath,
        templatePath,
      );
      if (result.success) {
        return result;
      }
      pptLogWarn(
        `模板版式匯出未成功（${result.issues[0]?.message ?? 'unknown'}），改以 Node 匯出`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pptLogWarn(`模板版式匯出失敗：${message}，改以 Node 匯出`);
    }
  } else if (useTemplateLayoutExport() && !templateReady) {
    pptLogWarn(`找不到模板檔 ${templatePath}，改以 Node 匯出`);
  }

  const backend = getPptxExportBackend();
  if (backend === 'python' && templateReady) {
    return runPythonTemplateGenerate(plan, outputPath, templatePath);
  }

  pptLog(`PPTX 匯出後端：${backend}（程式排版）`);
  return runNodeGenerate(plan, outputPath);
}
