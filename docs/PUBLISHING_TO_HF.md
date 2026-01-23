# Publishing to Hugging Face

This guide explains how to publish your scraped 2GIS dataset to Hugging Face.

**Example Published Dataset**: [tebuchet/org-reviews](https://huggingface.co/datasets/tebuchet/org-reviews)

## Prerequisites

1. **Hugging Face Account**: Create an account at [huggingface.co](https://huggingface.co)
2. **Access Token**: Get your token from [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. **Install HF CLI** (choose one):
   ```bash
   # Using uv (recommended)
   uv tool install huggingface_hub
   
   # Or using pip
   pip install huggingface_hub[cli]
   ```

## Quick Start

### 1. Prepare Your Dataset

First, scrape some data:

```bash
# Stage 1: Collect org IDs
bun scripts/scrape.ts --query "ресторан" --mode list --max-records 100

# Stage 2: Get full details with reviews
bun scripts/scrape.ts --from-list data/parsed/list/list-ресторан-*.json --mode full-with-reviews --max-reviews 100

# Stage 3: Export reviews dataset
bun scripts/export-reviews-dataset.ts
```

### 2. Convert to HF Format

```bash
# For reviews dataset (recommended for ML/sentiment analysis)
bun scripts/publish-to-hf.ts --dataset-name "username/dataset-name" --mode reviews

# For basic organization data
bun scripts/publish-to-hf.ts --dataset-name "username/dataset-name" --mode full

# For organizations with reviews embedded
bun scripts/publish-to-hf.ts --dataset-name "username/dataset-name" --mode full-with-reviews

# For list data only
bun scripts/publish-to-hf.ts --dataset-name "username/dataset-name" --mode list
```

Available modes:
- `reviews` - Simple text + rating pairs (ideal for sentiment analysis)
- `full` - Organization details only
- `full-with-reviews` - Organizations with embedded reviews
- `list` - Basic organization list from search

This will create:
- `data/hf-dataset-{mode}.jsonl` - Your dataset in JSONL format
- `data/hf-README.md` - Dataset card with metadata

### 3. Upload to Hugging Face

#### Option A: Using uv (Recommended)

```bash
# Login first (one-time setup)
uv tool run --from huggingface_hub hf login

# Upload dataset files
uv tool run --from huggingface_hub hf upload username/dataset-name data/hf-dataset-reviews.jsonl train.jsonl --repo-type dataset
uv tool run --from huggingface_hub hf upload username/dataset-name data/hf-README.md README.md --repo-type dataset
```

#### Option B: Using huggingface-cli (pip)

```bash
# Login
huggingface-cli login

# Create repository (public)
huggingface-cli repo create username/dataset-name --type dataset

# Or create private repository
huggingface-cli repo create username/dataset-name --type dataset --private

# Upload dataset
huggingface-cli upload username/dataset-name data/hf-dataset-reviews.jsonl train.jsonl --repo-type dataset
huggingface-cli upload username/dataset-name data/hf-README.md README.md --repo-type dataset
```

#### Option C: Using Python

```python
from huggingface_hub import HfApi

api = HfApi()

# Create repository
api.create_repo(
    repo_id="username/dataset-name",
    repo_type="dataset",
    private=False  # Set to True for private repo
)

# Upload files
api.upload_file(
    path_or_fileobj="data/hf-dataset-reviews.jsonl",
    path_in_repo="train.jsonl",
    repo_id="username/dataset-name",
    repo_type="dataset"
)

api.upload_file(
    path_or_fileobj="data/hf-README.md",
    path_in_repo="README.md",
    repo_id="username/dataset-name",
    repo_type="dataset"
)
```

#### Option D: Using Web Interface

1. Go to [huggingface.co/new-dataset](https://huggingface.co/new-dataset)
2. Create a new dataset repository
3. Upload `data/hf-dataset-{mode}.jsonl` as `train.jsonl`
4. Copy contents of `data/hf-README.md` to the dataset card editor

## Data Format

### JSONL Structure

Each line in the JSONL file is a JSON object:

```jsonl
{"name":"Restaurant Name","address":"Москва, ул. Тверская, 1","phone":"+79991234567","rating":4.5,...}
{"name":"Another Place","address":"Москва, пр. Ленина, 5","phone":"+79991234568","rating":4.8,...}
```

### Parquet Format (Optional)

To convert to Parquet format:

```python
import pandas as pd

# Read JSONL
df = pd.read_json('data/hf-dataset-full.jsonl', lines=True)

# Save as Parquet
df.to_parquet('data/hf-dataset-full.parquet', compression='snappy')

# Upload
huggingface-cli upload your-username/2gis-moscow-restaurants data/hf-dataset-full.parquet train.parquet
```

## Dataset Naming Conventions

Good dataset names:
- `tebuchet/org-reviews` ✅ (Published example)
- `username/2gis-moscow-restaurants` - Clear, specific
- `username/2gis-organizations-russia` - Geographic scope
- `username/2gis-poi-with-reviews` - Content description

Avoid:
- `username/dataset` - Too generic
- `username/2gis-data-123` - No description
- `username/MyDataset` - Use kebab-case

## Usage Examples

### Python

```python
from datasets import load_dataset

# Load the published dataset
dataset = load_dataset("tebuchet/org-reviews")

# Access reviews data
for review in dataset['train']:
    print(f"[{review['rating']}⭐] {review['text'][:50]}...")
```

### Pandas

```python
import pandas as pd
from datasets import load_dataset

# Load as DataFrame
dataset = load_dataset("tebuchet/org-reviews")
df = pd.DataFrame(dataset['train'])

# Analyze reviews
print(df['rating'].describe())
print(df.groupby('rating').size())
```

## Best Practices

1. **Data Quality**: Clean and validate data before uploading
2. **Documentation**: Fill in the dataset card with detailed information
3. **Licensing**: Choose appropriate license (MIT recommended for public data)
4. **Updates**: Version your dataset with tags when adding new data
5. **Ethics**: Respect privacy and terms of service

## Versioning

To create a new version:

```bash
# Upload to a specific revision (uv)
uv tool run --from huggingface_hub hf upload username/dataset-name \
  data/hf-dataset-reviews.jsonl train.jsonl \
  --repo-type dataset --revision v2.0

# Or with huggingface-cli
huggingface-cli upload username/dataset-name \
  data/hf-dataset-reviews.jsonl train.jsonl \
  --repo-type dataset --revision v2.0
```

## Troubleshooting

### Authentication Error
```bash
# Re-login with uv
uv tool run --from huggingface_hub hf login

# Or with huggingface-cli
huggingface-cli login --token YOUR_TOKEN
```

### Large Files
For files > 5GB, use Git LFS:
```bash
git lfs install
huggingface-cli lfs-enable-largefiles .
```

### Private vs Public
To change visibility:
```bash
# Make public
huggingface-cli repo update your-username/dataset-name --public

# Make private
huggingface-cli repo update your-username/dataset-name --private
```

## Advanced: Split Train/Test Sets

```typescript
// In publish-to-hf.ts, split data:
const allData = lines.map(l => JSON.parse(l));
const trainSize = Math.floor(allData.length * 0.8);

const train = allData.slice(0, trainSize);
const test = allData.slice(trainSize);

await writeFile('data/train.jsonl', train.map(d => JSON.stringify(d)).join('\\n'));
await writeFile('data/test.jsonl', test.map(d => JSON.stringify(d)).join('\\n'));
```

Then upload both files:
```bash
huggingface-cli upload your-username/dataset data/train.jsonl train.jsonl
huggingface-cli upload your-username/dataset data/test.jsonl test.jsonl
```

## Resources

- [HF Dataset Documentation](https://huggingface.co/docs/datasets)
- [Dataset Card Guide](https://huggingface.co/docs/hub/datasets-cards)
- [HF CLI Reference](https://huggingface.co/docs/huggingface_hub/guides/cli)
