// Publish reviews dataset to Hugging Face
// Usage: bun scripts/publish-to-hf.ts --dataset-name "username/dataset-name"

import { getUploadInstructions, type HFConfig, prepareDataset } from '../src/publisher.js';
import { PublisherRepository } from '../src/repos/index.js';
import { parseArgs } from '../src/utils.js';

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    'dataset-name': '',
    private: 'false',
  });

  const config: HFConfig = {
    datasetName: args['dataset-name'],
    privateRepo: args.private === 'true',
  };

  if (!config.datasetName) {
    console.error('Error: --dataset-name is required (e.g., "username/org-reviews")');
    process.exit(1);
  }

  const repository = new PublisherRepository();

  console.log('🚀 Preparing reviews dataset for Hugging Face upload...');
  console.log(`   Dataset: ${config.datasetName}`);
  console.log(`   Private: ${config.privateRepo}`);

  try {
    console.log('\n📁 Collecting reviews data...');
    const result = await prepareDataset(config, repository);

    console.log(`   ✓ Generated ${result.stats.totalRecords} reviews`);
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
