# Publishing to Hugging Face

Publish your scraped 2GIS reviews to Hugging Face.

**Published Dataset**: [tebuchet/org-reviews](https://huggingface.co/datasets/tebuchet/org-reviews)

## Quick Start

```bash
# 1. Login (one-time)
uv tool run --from huggingface_hub hf login

# 2. Scrape and export reviews
bun scripts/scrape.ts --query "ресторан" --mode list --max-records 100
bun scripts/scrape.ts --from-list data/parsed/list/list-*.json --mode full-with-reviews --max-reviews 100
bun scripts/export-reviews-dataset.ts

# 3. Prepare dataset
bun scripts/publish-to-hf.ts --dataset-name "tebuchet/org-reviews"

# 4. Upload
uv tool run --from huggingface_hub hf upload tebuchet/org-reviews data/hf-dataset-reviews.jsonl train.jsonl --repo-type dataset
uv tool run --from huggingface_hub hf upload tebuchet/org-reviews data/hf-README.md README.md --repo-type dataset
```

## Data Format

JSONL with one review per line:

```jsonl
{"text":"Great place!","rating":5}
{"text":"Not recommended","rating":1}
```

## Usage

```python
from datasets import load_dataset

dataset = load_dataset("tebuchet/org-reviews")
for review in dataset['train']:
    print(f"[{review['rating']}⭐] {review['text'][:50]}...")
```

## Troubleshooting

```bash
# Re-login
uv tool run --from huggingface_hub hf login

# For large files (>5GB)
git lfs install
```

## Resources

- [HF Datasets Docs](https://huggingface.co/docs/datasets)
- [HF CLI Reference](https://huggingface.co/docs/huggingface_hub/guides/cli)
