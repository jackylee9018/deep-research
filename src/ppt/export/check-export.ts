import { readFile } from 'fs/promises';
import path from 'path';

import { deckPlanSchema } from '../schemas';
import { getPptxExportBackend } from './export-backend';
import { runPptExport } from './run-ppt-export';

const REPO_ROOT = process.cwd();
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  'skills/pptx/fixtures/deck-plan.json',
);
const OUTPUT_PATH = '/tmp/deep-research-ppt-export-check.pptx';

async function main() {
  const raw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  const plan = deckPlanSchema.parse(raw);

  console.log(`PPTX export backend: ${getPptxExportBackend()}`);
  const result = await runPptExport({
    action: 'generate',
    plan,
    outputPath: OUTPUT_PATH,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
