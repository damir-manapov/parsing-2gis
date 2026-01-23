// Publish scraped data to Hugging Face datasets
// Usage: bun scripts/publish-to-hf.ts --dataset-name "username/2gis-organizations" --mode full

import { readdir, readFile } from 'node:fs/promises';
import { parseArgs } from '../src/utils.js';

interface HFConfig {
  datasetName: string; // e.g., "username/2gis-organizations"
  mode: 'list' | 'full' | 'full-with-reviews';
  privateRepo: boolean;
  outputFormat: 'jsonl' | 'parquet';
}

async function collectDataFiles(mode: string): Promise<string[]> {
  const basePath = `data/parsed/${mode}`;

  try {
    if (mode === 'list') {
      // Collect all list files
      const files = await readdir(`${basePath}`);
      return files.filter((f) => f.endsWith('.json')).map((f) => `${basePath}/${f}`);
    } else {
      // Collect organization files
      const files = await readdir(`${basePath}/organizations`);
      return files
        .filter((f) => f.endsWith('.json') && !f.includes('manifest'))
        .map((f) => `${basePath}/organizations/${f}`);
    }
  } catch (error) {
    console.error(`Error reading ${basePath}:`, error);
    return [];
  }
}

async function convertToJSONL(files: string[]): Promise<string> {
  const lines: string[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const parsed = JSON.parse(content);

      // Extract data (handle both {meta, data} and direct data formats)
      const data = parsed.data || parsed;

      if (Array.isArray(data)) {
        // List mode: multiple orgs per file
        for (const item of data) {
          lines.push(JSON.stringify(item));
        }
      } else {
        // Full mode: single org per file
        lines.push(JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return lines.join('\n');
}

async function generateDatasetCard(
  config: HFConfig,
  stats: { totalRecords: number; totalFiles: number },
): Promise<string> {
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
- ${stats.totalRecords < 1000 ? 'n<1K' : stats.totalRecords < 10000 ? '1K<n<10K' : '10K<n<100K'}
---

# 2GIS Organizations Dataset

This dataset contains scraped organization data from 2GIS (Russia's leading local search and maps service).

## Dataset Description

- **Mode**: ${config.mode}
- **Total Records**: ${stats.totalRecords}
- **Total Files**: ${stats.totalFiles}
- **Format**: ${config.outputFormat.toUpperCase()}

## Data Fields

${
  config.mode === 'list'
    ? `
### List Mode
- \`name\`: Organization name
- \`orgId\`: Unique organization identifier
- \`rubrics\`: List of business categories
`
    : config.mode === 'full'
      ? `
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
`
      : `
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
`
}

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

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    'dataset-name': '',
    mode: 'full',
    private: 'false',
    format: 'jsonl',
  });

  const config: HFConfig = {
    datasetName: args['dataset-name'],
    mode: args.mode as 'list' | 'full' | 'full-with-reviews',
    privateRepo: args.private === 'true',
    outputFormat: args.format as 'jsonl' | 'parquet',
  };

  if (!config.datasetName) {
    console.error('Error: --dataset-name is required (e.g., "username/2gis-organizations")');
    process.exit(1);
  }

  console.log('🚀 Preparing dataset for Hugging Face upload...');
  console.log(`   Dataset: ${config.datasetName}`);
  console.log(`   Mode: ${config.mode}`);
  console.log(`   Format: ${config.outputFormat}`);
  console.log(`   Private: ${config.privateRepo}`);

  // Collect data files
  console.log('\n📁 Collecting data files...');
  const files = await collectDataFiles(config.mode);
  console.log(`   Found ${files.length} files`);

  if (files.length === 0) {
    console.error('Error: No data files found. Please scrape some data first.');
    process.exit(1);
  }

  // Convert to JSONL
  console.log('\n🔄 Converting to JSONL...');
  const jsonlContent = await convertToJSONL(files);
  const lines = jsonlContent.split('\n').filter((l) => l.trim());
  console.log(`   Generated ${lines.length} records`);

  // Save JSONL file
  const outputPath = `data/hf-dataset-${config.mode}.jsonl`;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(outputPath, jsonlContent);
  console.log(`   ✓ Saved to ${outputPath}`);

  // Generate dataset card
  console.log('\n📝 Generating dataset card...');
  const stats = { totalRecords: lines.length, totalFiles: files.length };
  const datasetCard = await generateDatasetCard(config, stats);
  const readmePath = `data/hf-README.md`;
  await writeFile(readmePath, datasetCard);
  console.log(`   ✓ Saved to ${readmePath}`);

  // Instructions for upload
  console.log('\n📤 Next steps to upload to Hugging Face:');
  console.log('\n1. Install Hugging Face CLI:');
  console.log('   pip install huggingface_hub[cli]');
  console.log('\n2. Login to Hugging Face:');
  console.log('   huggingface-cli login');
  console.log('\n3. Create repository:');
  console.log(
    `   huggingface-cli repo create ${config.datasetName} --type dataset${config.privateRepo ? ' --private' : ''}`,
  );
  console.log('\n4. Upload files:');
  console.log(`   huggingface-cli upload ${config.datasetName} ${outputPath} train.jsonl`);
  console.log(`   huggingface-cli upload ${config.datasetName} ${readmePath} README.md`);
  console.log('\n✨ Done! Your dataset is ready for upload.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
