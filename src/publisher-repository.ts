/**
 * Repository for Hugging Face dataset publishing operations
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

export type PublishMode = 'list' | 'full' | 'full-with-reviews' | 'reviews';

export interface PublishStats {
  totalRecords: number;
  totalFiles: number;
}

export interface PrepareResult {
  jsonlPath: string;
  readmePath: string;
  stats: PublishStats;
}

export class PublisherRepository {
  /**
   * Collect data files for a given publish mode
   */
  async collectDataFiles(mode: PublishMode): Promise<string[]> {
    // Special case: reviews mode uses pre-exported file
    if (mode === 'reviews') {
      const exportedPath = 'data/exports/reviews-dataset.jsonl';
      if (existsSync(exportedPath)) {
        return [exportedPath];
      }
      return [];
    }

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
   * Save dataset file
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
        // If it's already a JSONL file, read it directly
        if (file.endsWith('.jsonl')) {
          const content = await readFile(file, 'utf-8');
          const jsonlLines = content.split('\n').filter((l) => l.trim());
          lines.push(...jsonlLines);
          continue;
        }

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

  /**
   * Prepare dataset files for upload
   */
  async prepareDataset(
    mode: PublishMode,
    generateReadme: (stats: PublishStats) => string,
  ): Promise<PrepareResult> {
    const files = await this.collectDataFiles(mode);

    if (files.length === 0) {
      throw new Error(`No data files found for mode: ${mode}`);
    }

    const jsonlContent = await this.convertToJSONL(files);
    const lines = jsonlContent.split('\n').filter((l) => l.trim());

    const stats: PublishStats = {
      totalRecords: lines.length,
      totalFiles: files.length,
    };

    const jsonlPath = await this.saveDatasetFile(`hf-dataset-${mode}.jsonl`, jsonlContent);
    const readmePath = await this.saveDatasetFile('hf-README.md', generateReadme(stats));

    return { jsonlPath, readmePath, stats };
  }
}
