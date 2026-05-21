import { spawn } from 'child_process';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { pptLog, pptLogError } from '../log';
import {
  deckPlanSchema,
  pptxSkillResultSchema,
  type DeckPlan,
  type PptxSkillResult,
} from '../schemas';

const REPO_ROOT = process.cwd();
const DEFAULT_SCRIPT_PATH = path.join(
  REPO_ROOT,
  'skills',
  'pptx',
  'generate.py',
);
const DEFAULT_TEMPLATE_PATH = path.join(REPO_ROOT, 'templates', 'default.pptx');

type RunPptxSkillOptions =
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

function parseSkillOutput(stdout: string): PptxSkillResult {
  const lines = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const lastJsonLine = [...lines].reverse().find(line => line.startsWith('{'));

  if (!lastJsonLine) {
    throw new Error('PPTX skill did not return JSON');
  }

  return pptxSkillResultSchema.parse(JSON.parse(lastJsonLine));
}

async function runPython(
  args: string[],
  timeoutMs = 60_000,
): Promise<PptxSkillResult> {
  const python = process.env.PPTX_PYTHON || 'python3';
  pptLog(`執行 Python：${python} ${DEFAULT_SCRIPT_PATH} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(python, [DEFAULT_SCRIPT_PATH, ...args], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('PPTX skill timed out'));
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('error', error => {
      clearTimeout(timer);
      pptLogError('無法啟動 Python 程序', error);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      try {
        const result = parseSkillOutput(stdout);
        if (code !== 0 && !result.issues.length) {
          const message =
            stderr.trim() || `PPTX skill exited with code ${code}`;
          pptLogError(`Python 結束 code=${code}：${message}`);
          reject(new Error(message));
          return;
        }
        pptLog(
          `Python 完成 code=${code}｜success=${result.success}｜${result.slide_count ?? '?'} 頁｜issues=${result.issues.length}`,
        );
        if (stderr.trim()) {
          pptLog(`  stderr：${stderr.trim().slice(0, 500)}`);
        }
        resolve(result);
      } catch (error) {
        pptLogError('Python 輸出解析失敗', error);
        reject(
          new Error(
            [
              error instanceof Error ? error.message : String(error),
              stderr.trim() ? `stderr: ${stderr.trim()}` : undefined,
              stdout.trim() ? `stdout: ${stdout.trim()}` : undefined,
            ]
              .filter(Boolean)
              .join('\n'),
          ),
        );
      }
    });
  });
}

export async function runPptxSkill(
  options: RunPptxSkillOptions,
): Promise<PptxSkillResult> {
  const dir = await mkdtemp(path.join(tmpdir(), 'deep-research-ppt-'));
  const planPath = path.join(dir, 'deck-plan.json');
  const plan = deckPlanSchema.parse(options.plan);
  await writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

  if (options.action === 'validate') {
    return runPython(['validate', '--plan', planPath]);
  }

  const outputPath = options.outputPath ?? path.join(dir, 'deck.pptx');
  const templatePath =
    options.templatePath ??
    process.env.PPTX_TEMPLATE_PATH ??
    DEFAULT_TEMPLATE_PATH;

  return runPython([
    'generate',
    '--plan',
    planPath,
    '--output',
    outputPath,
    '--template',
    templatePath,
  ]);
}
