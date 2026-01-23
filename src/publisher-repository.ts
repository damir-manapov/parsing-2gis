/**
 * Repository for Hugging Face dataset publishing operations
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

export type PublishMode = 'list' | 'full' | 'full-with-reviews';

export class PublisherRepository {
  /**
   * Collect data files for a given publish mode
   */
  async collectDataFiles(mode: PublishMode): Promise<string[]> {
    const basePath = `data/parsed/${mode}`;

    try {
      if (mode === 'list') {
        const files = await readdir(basePath);
        return files.filter((f) => f.endsWith('.json')).map((f) => `${basePath}/${f}`);
      }
      const files = await readdir(`${basePath}/organizations`);
      return files
        .filter((f) => f.endsWith('.json') && !f.includes('manifest'))
        .map((f) => `${basePath}/organizations/${f}`);
    } catch {
      return [];
    }
  }

  /**
   * Read and parse a JSON file
   */
  async readJsonFile(filePath: string): Promise<unknown> {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save dataset file (for HF publishing)
   */
  async saveDatasetFile(filename: string, content: string): Promise<string> {
    await mkdir('data', { recursive: true });
    const filePath = `data/${filename}`;
    await writeFile(filePath, content);
    return filePath;
  }

  /**
   * Convert data files to JSONL format
   */
  async convertToJSONL(files: string[]): Promise<string> {
    const lines: string[] = [];

    for (const file of files) {
      try {
        const parsed = await this.readJsonFile(file);
        const data = (parsed as { data?: unknown }).data || parsed;

        if (Array.isArray(data)) {
          for (const item of data) {
            lines.push(JSON.stringify(item));
          }
        } else {
          lines.push(JSON.stringify(data));
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    return lines.join('\n');
  }
}
