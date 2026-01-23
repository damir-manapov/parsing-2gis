/**
 * Publisher for Hugging Face datasets
 * Generates dataset cards and upload instructions for reviews dataset
 */

import type { PrepareResult, PublisherRepository, PublishStats } from './repos/index.js';

export type { PublishStats, PrepareResult };

export interface HFConfig {
  datasetName: string;
  privateRepo: boolean;
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
language:
- ru
tags:
- 2gis
- organizations
- reviews
- moscow
- sentiment-analysis
pretty_name: 2GIS Organizations Reviews Dataset
size_categories:
- ${getSizeCategory(stats.totalRecords)}
---

# 2GIS Organizations Reviews Dataset

This dataset contains reviews scraped from 2GIS (Russia's leading local search and maps service).

## Dataset Description

- **Total Reviews**: ${stats.totalRecords}
- **Format**: JSONL

## Data Fields

- \`text\`: Review text content
- \`rating\`: Rating (1-5 stars)

## Usage

\`\`\`python
from datasets import load_dataset

dataset = load_dataset("${config.datasetName}")

for review in dataset['train']:
    print(f"[{review['rating']}⭐] {review['text'][:50]}...")
\`\`\`

## Data Collection

Data was collected using Playwright browser automation to scrape public reviews from 2GIS.

## License

MIT License - This dataset is provided for research and educational purposes.

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
): Promise<PrepareResult> {
  return repository.prepareDataset((stats) => generateDatasetCard(config, stats));
}

/**
 * Get upload instructions for Hugging Face CLI
 */
export function getUploadInstructions(config: HFConfig, result: PrepareResult): string {
  return `
📤 Next steps to upload to Hugging Face:

1. Upload files using uv:
   uv tool run --from huggingface_hub hf upload ${config.datasetName} ${result.jsonlPath} train.jsonl --repo-type dataset
   uv tool run --from huggingface_hub hf upload ${config.datasetName} ${result.readmePath} README.md --repo-type dataset

✨ Done! Your dataset is ready for upload.
`;
}
