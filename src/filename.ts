import * as fs from 'fs/promises';
import * as path from 'path';

import { filenameFromTitle, slugifyForFilename } from './slugify';

export { slugifyForFilename, filenameFromTitle };

export async function resolveUniqueFilename(
  dir: string,
  filename: string,
): Promise<string> {
  const ext = path.extname(filename) || '.md';
  const base = path.basename(filename, ext);
  let candidate = filename;
  let counter = 1;

  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      candidate = `${base}-${counter}${ext}`;
      counter++;
    } catch {
      return candidate;
    }
  }
}
