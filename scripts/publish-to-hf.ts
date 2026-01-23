// Publish scraped data to Hugging Face datasets
// Usage: bun scripts/publish-to-hf.ts --dataset-name "username/2gis-organizations" --mode full

import {
  getUploadInstructions,
  type HFConfig,
  type OutputFormat,
  type PublishMode,
  prepareDataset,
} from '../src/publisher.js';
import { parseArgs } from '../src/utils.js';

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    'dataset-name': '',
    mode: 'full',
    private: 'false',
    format: 'jsonl',
  });

  const config: HFConfig = {
    datasetName: args['dataset-name'],
    mode: args.mode as PublishMode,
    privateRepo: args.private === 'true',
    outputFormat: args.format as OutputFormat,
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

  try {
    console.log('\n📁 Collecting and converting data...');
    const result = await prepareDataset(config);

    console.log(`   ✓ Found ${result.stats.totalFiles} files`);
    console.log(`   ✓ Generated ${result.stats.totalRecords} records`);
    console.log(`   ✓ Saved to ${result.jsonlPath}`);
    console.log(`   ✓ README saved to ${result.readmePath}`);

    console.log(getUploadInstructions(config, result));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
