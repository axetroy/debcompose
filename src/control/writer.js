import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createControlData, formatControl } from './schema.js';

const CONTROL_FILE = 'control';

/**
 * Write a Debian control file to disk.
 * @param {string} outputDir   - Target directory (typically DEBIAN/)
 * @param {import('./schema.js').ControlParams} params - Control field values
 */
export async function writeControl(outputDir, params) {
  const data = createControlData(params);
  const content = formatControl(data);
  const outputPath = join(outputDir, CONTROL_FILE);
  await writeFile(outputPath, content, 'utf-8');
}
