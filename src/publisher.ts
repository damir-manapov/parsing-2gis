/**
 * Publisher for Hugging Face datasets
 * Converts scraped data to HF-compatible formats and generates dataset cards
 */

import type { PublisherRepository, PublishMode } from './publisher-repository.js';

export type { PublishMode };
export type OutputFormat = 'jsonl' | 'parquet';

export interface HFConfig {
  datasetName: string;
  mode: PublishMode;
  privateRepo: boolean;
  outputFormat: OutputFormat;
}

export interface PublishStats {
  totalRecords: number;
  totalFiles: number;
}

export interface PublishResult {
  jsonlPath: string;
  readmePath: string;
  stats: PublishStats;
}

/**
 * Convert data files to JSONL format
 */
export async function convertToJSONL(
  files: string[],
  repository: PublisherRepository,
): Promise<string> {
  const lines: string[] = [];

  for (const file of files) {
    try {
      const parsed = await repository.readJsonFile(file);
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
 * Get field descriptions for dataset card based on mode
 */
function getFieldDescriptions(mode: PublishMode): string {
  if (mode === 'list') {
    return `
### List Mode
- \`name\`: Organization name
- \`orgId\`: Unique organization identifier
- \`rubrics\`: List of business categories
`;
  }

  if (mode === 'full') {
    return `
### Full Mode
- \`name\`: Organization name
- \`description\`: Business description
- \`address\`: Full address
- \`phone\`: Contact phone number
- \`email\`: Contact email
- \`website\`: Organization website
- \`coordinates\`: {lat, lon} object
- \`rating\`: Average rating
- \`reviewCount\`: Total number of reviews
- \`rubrics\`: List of business categories
- \`schedule\`: Working hours
- \`nearestMetro\`: List of nearby metro stations
- \`paymentMethods\`: Accepted payment methods
- \`features\`: Organization features
- \`orgId\`: Unique organization identifier
`;
  }

  return `
### Full with Reviews Mode
All fields from Full Mode, plus:
- \`reviews\`: Array of review objects
  - \`id\`: Review ID
  - \`text\`: Review text
  - \`rating\`: Review rating (1-5)
  - \`author\`: Author name
  - \`dateCreated\`: Review creation date
  - \`likes\`: Number of likes
  - \`dislikes\`: Number of dislikes
  - \`source\`: Review source (2GIS, Flamp, etc.)
`;
}

/**
 * Get size category for dataset card
 */
function getSizeCategory(count: number): string {
  if (count < 1000) return 'n<1K';
  if (count < 10000) return '1K<n<10K';
  return '10K<n<100K';
}

/**
 * Generate Hugging Face dataset card (README.md)
 */
export function generateDatasetCard(config: HFConfig, stats: PublishStats): string {
  return `---
license: mit
task_categories:
- text-classification
- information-extraction
language:
- ru
tags:
- 2gis
- organizations
- moscow
- poi
- geospatial
pretty_name: 2GIS Organizations Dataset
size_categories:
- ${getSizeCategory(stats.totalRecords)}
---

# 2GIS Organizations Dataset

This dataset contains scraped organization data from 2GIS (Russia's leading local search and maps service).

## Dataset Description

- **Mode**: ${config.mode}
- **Total Records**: ${stats.totalRecords}
- **Total Files**: ${stats.totalFiles}
- **Format**: ${config.outputFormat.toUpperCase()}

## Data Fields
${getFieldDescriptions(config.mode)}

## Data Collection

Data was collected using Playwright browser automation to scrape public information from 2GIS.

## Usage

\`\`\`python
from datasets import load_dataset

dataset = load_dataset("${config.datasetName}")
\`\`\`

## License

MIT License - This dataset is provided for research and educational purposes.

## Citation

\`\`\`bibtex
@misc{2gis_dataset,
  author = {Your Name},
  title = {2GIS Organizations Dataset},
  year = {2026},
  publisher = {Hugging Face},
  howpublished = {\\\\url{https://huggingface.co/datasets/${config.datasetName}}}
}
\`\`\`

## Disclaimer

This dataset contains publicly available information from 2GIS. Users should respect the original data source's terms of service.
`;
}

/**
 * Prepare dataset files for Hugging Face upload
 */
export async function prepareDataset(
  config: HFConfig,
  repository: PublisherRepository,
): Promise<PublishResult> {
  const files = await repository.collectDataFiles(config.mode);

  if (files.length === 0) {
    throw new Error(`No data files found for mode: ${config.mode}`);
  }

  const jsonlContent = await convertToJSONL(files, repository);
  const lines = jsonlContent.split('\n').filter((l) => l.trim());

  const stats: PublishStats = {
    totalRecords: lines.length,
    totalFiles: files.length,
  };

  const jsonlFilename = `hf-dataset-${config.mode}.jsonl`;
  const readmeFilename = 'hf-README.md';

  const jsonlPath = await repository.saveDatasetFile(jsonlFilename, jsonlContent);
  const datasetCard = generateDatasetCard(config, stats);
  const readmePath = await repository.saveDatasetFile(readmeFilename, datasetCard);

  return {
    jsonlPath,
    readmePath,
    stats,
  };
}

/**
 * Get upload instructions for Hugging Face CLI
 */
export function getUploadInstructions(config: HFConfig, result: PublishResult): string {
  return `
📤 Next steps to upload to Hugging Face:

1. Install Hugging Face CLI:
   pip install huggingface_hub[cli]

2. Login to Hugging Face:
   huggingface-cli login

3. Create repository:
   huggingface-cli repo create ${config.datasetName} --type dataset${config.privateRepo ? ' --private' : ''}

4. Upload files:
   huggingface-cli upload ${config.datasetName} ${result.jsonlPath} train.jsonl
   huggingface-cli upload ${config.datasetName} ${result.readmePath} README.md

✨ Done! Your dataset is ready for upload.
`;
}
