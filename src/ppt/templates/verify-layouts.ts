import { spawnSync } from 'child_process';
import path from 'path';

const REPO_ROOT = process.cwd();
const scriptPath = path.join(REPO_ROOT, 'skills', 'pptx', 'verify_templates.py');

export function runTemplateLayoutVerify(): number {
  const result = spawnSync('python3', [scriptPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result.status ?? 1;
}

if (require.main === module) {
  process.exit(runTemplateLayoutVerify());
}
