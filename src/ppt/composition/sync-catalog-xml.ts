import { writeFileSync } from 'fs';
import path from 'path';

import { compositionCatalogXml } from './load-catalog';

const outPath = path.join(__dirname, 'catalog.xml');

const xml = compositionCatalogXml();
writeFileSync(outPath, `${xml}\n`, 'utf8');
console.log(`Wrote ${outPath} (${xml.split('\n').length} lines)`);
