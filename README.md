# LumenAI

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-0.4-1C3C3C?logo=langchain&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)
![GCP](https://img.shields.io/badge/Google_Cloud-Vision_|_Video_|_Gemini-4285F4?logo=googlecloud&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Cloud_Run-Deployed-4285F4?logo=googlecloud&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)

**A video data pipeline that fetches, filters, scores, indexes, and curates video datasets — clip by clip.**

LumenAI is an end-to-end AI-powered video curation platform. Users describe the dataset they need in natural language, and the system autonomously fetches videos, runs multi-stage quality filters using Google Cloud AI services, builds searchable vector indexes, and delivers a packaged dataset with scored clips and generated captions.

---

## How It Works

1. **User describes a dataset** — "outdoor cooking videos, daytime lighting, no logos"
2. **AI parses the order** — Gemini Flash extracts keywords, quality thresholds, and content filters
3. **Videos are fetched** — Pexels API provides royalty-free clips matching the keywords
4. **Frames are extracted** — FFmpeg decodes each clip at 1fps
5. **Hard gates reject bad clips** — Cloud Vision detects logos/watermarks, Video Intelligence flags NSFW content, Gemini Flash scores sharpness
6. **Quality scoring ranks the rest** — Gemini Flash Vision scores aesthetic quality, semantic relevance, motion intensity, and generates captions
7. **Decision split routes clips** — Weighted formula (0.35 aesthetic + 0.30 semantic + 0.20 sharpness + 0.15 motion) routes to accept / margin / reject
8. **Accepted clips are indexed** — Vertex AI Multimodal Embeddings + FAISS vector index + DuckDB metadata
9. **Dataset is packaged** — Manifest with scores, captions, signed download URLs, exported as a zip

---

## Pipeline Nodes

The pipeline is orchestrated by **LangGraph** as a sequential state graph with 7 nodes:

### Stage 1: Order Parsing

|                  |                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service**      | Gemini 2.5 Flash (Vertex AI)                                                                                                                                                          |
| **Input**        | Natural language description + target duration                                                                                                                                        |
| **Output**       | Structured spec: keywords, thresholds, quality tier, content filters                                                                                                                  |
| **What it does** | Parses "outdoor cooking, daytime, no logos" into `{keywords: ["outdoor cooking", "campfire", ...], thresholds: {aesthetic_min: 0.5, motion_max: 0.3}, content_filters: ["no_logos"]}` |

### Stage 2: Ingest

|                  |                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Service**      | Pexels API + FFmpeg + GCS                                                                                                   |
| **Input**        | Parsed keywords from Stage 1                                                                                                |
| **Output**       | Video clips + extracted frames uploaded to GCS                                                                              |
| **What it does** | Searches Pexels by keyword, downloads clips, extracts frames at 1fps via FFmpeg, uploads everything to Google Cloud Storage |

### Stage 3a: Hard Gates

|             |                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Service** | Gemini Flash Vision + Cloud Vision + Video Intelligence                                                                                                                  |
| **Input**   | Extracted frames from Stage 2                                                                                                                                            |
| **Output**  | Clips that pass all gates forwarded; rejected clips discarded                                                                                                            |
| **Gates**   | Sharpness (Gemini Flash), Safety/NSFW (Video Intelligence), Logo detection (Cloud Vision), Watermark/text detection (Cloud Vision), Label relevance (Video Intelligence) |

### Stage 3b: Quality Scoring

|                  |                                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| **Service**      | Gemini 2.5 Flash Vision (Vertex AI)                                            |
| **Input**        | 4 sampled frames per clip + order description                                  |
| **Output**       | Per-clip scores: aesthetic (0-1), semantic (0-1), motion (0-1), caption        |
| **What it does** | Single API call per clip returns all quality dimensions + a 2-sentence caption |

### Stage 3c: Decision Split

|                |                                                                         |
| -------------- | ----------------------------------------------------------------------- |
| **Service**    | Custom Python                                                           |
| **Input**      | Quality scores from Stage 3b                                            |
| **Output**     | Clips routed to accept / margin / reject                                |
| **Formula**    | `0.35 * aesthetic + 0.30 * semantic + 0.20 * sharpness + 0.15 * motion` |
| **Thresholds** | > 0.55 accept, 0.35-0.55 margin (QA queue), < 0.35 reject               |

### Stage 4: Search & Index

|                  |                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Service**      | Vertex AI Multimodal Embeddings + FAISS + DuckDB                                                                             |
| **Input**        | Accepted clips from Stage 3c                                                                                                 |
| **Output**       | FAISS vector index + Parquet metadata uploaded to GCS                                                                        |
| **What it does** | Generates 1408-dim embeddings via Vertex AI, builds HNSW index (M=32, ef_search=200), exports metadata to Parquet via DuckDB |

### Stage 5: Deliver

|                  |                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Service**      | GCS Signed URLs                                                                                             |
| **Input**        | Accepted clips + index + metadata                                                                           |
| **Output**       | Downloadable zip: clips + manifest.json                                                                     |
| **What it does** | Generates signed URLs for all clips, builds manifest with scores/captions/summary, packages as zip download |

---

## Tech Stack

### Frontend

| Technology     | Purpose                                            |
| -------------- | -------------------------------------------------- |
| Next.js 16     | App framework, routing, SSR                        |
| React 19       | UI components                                      |
| Tailwind CSS 4 | Styling, dark mode                                 |
| shadcn/ui      | Component library (sidebar, dialog, sheet, sonner) |
| Lucide Icons   | Node cards, sidebar icons                          |

### Backend

| Technology  | Purpose                                      |
| ----------- | -------------------------------------------- |
| FastAPI     | REST API, async background tasks             |
| LangGraph   | Pipeline orchestration (StateGraph, 7 nodes) |
| Python 3.12 | Runtime                                      |

### Google Cloud Platform

| Service              | Used in         | Purpose                                                          |
| -------------------- | --------------- | ---------------------------------------------------------------- |
| Gemini 2.5 Flash     | Stage 1, 3a, 3b | Order parsing, sharpness detection, quality scoring + captioning |
| Video Intelligence   | Stage 3a        | NSFW detection, label detection, shot change detection           |
| Cloud Vision         | Stage 3a        | Logo detection, text/watermark detection (OCR)                   |
| Vertex AI Embeddings | Stage 4         | 1408-dim multimodal embeddings ($0.0001/image)                   |
| Cloud Storage (GCS)  | Stage 2, 4, 5   | Video clips, frames, FAISS index, manifests                      |
| Cloud Run            | Hosting         | Backend deployment, scales to zero                               |

### Database & Storage

| Technology          | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| Supabase (Postgres) | Orders, clips, filter scores, QA labels, embeddings |
| FAISS               | HNSW vector index for semantic search               |
| DuckDB              | Metadata queries, Parquet export                    |

### Infrastructure

| Technology | Purpose                     |
| ---------- | --------------------------- |
| Vercel     | Frontend deployment         |
| Cloud Run  | Backend deployment          |
| Pexels API | Video source (royalty-free) |
| FFmpeg     | Frame extraction            |

---

## Architecture

```
User (Next.js)
  |
  |  POST /workflows
  v
FastAPI (Cloud Run)
  |
  |  LangGraph StateGraph
  v
[Order Parsing] ──> [Ingest] ──> [Hard Gates] ──> [Quality Scoring] ──> [Decision Split] ──> [Search & Index] ──> [Deliver]
  Gemini Flash       Pexels       Cloud Vision      Gemini Flash          Custom Python       Vertex AI Embed      GCS
                     FFmpeg       Video Intel.       Vision                                    FAISS + DuckDB       Signed URLs
                     GCS          Gemini Flash
  |                                                                                                                   |
  |  Updates node_states in Supabase after each node                                                                  |
  v                                                                                                                   v
Supabase Postgres ─────────────────── Frontend polls GET /workflows/{id} every 2s ──────────────────> Canvas updates live
```

---

## Database Schema

```sql
orders        (id, description, target_minutes, status, parsed_query, current_node, node_states, created_at)
clips         (id, order_id, pexels_url, pexels_id, path, status, duration_s, width, height, metadata)
filter_scores (id, clip_id, filter_name, score, model_version, details)
qa_labels     (id, clip_id, reviewer_id, decision)
jobs          (id, type, status, order_id, clip_id, error, started_at, finished_at)
embeddings    (id, clip_id, vector_path, model_version)
```

---

## API Endpoints

| Method | Endpoint                 | Description                                |
| ------ | ------------------------ | ------------------------------------------ |
| `GET`  | `/health`                | Health check                               |
| `POST` | `/workflows`             | Create workflow + start pipeline           |
| `GET`  | `/workflows`             | List all workflows                         |
| `GET`  | `/workflows/{id}`        | Get workflow status + node states          |
| `GET`  | `/workflows/{id}/export` | Download dataset as zip (clips + manifest) |

---

## Project Structure

```
lumen-ai/                          # Frontend (Next.js)
  app/
    dashboard/page.tsx             # Dashboard with metrics, funnel, table
    workflows/page.tsx             # Create + monitor workflows
    workflows/[id]/page.tsx        # View specific workflow
    settings/page.tsx              # Settings
  components/
    agent-node.tsx                 # Pipeline node card component
    agent-drawer.tsx               # Right-side drawer with logs
    workflow-canvas.tsx            # Draggable canvas with nodes
    app-sidebar.tsx                # Navigation sidebar
  lib/
    workflow-types.ts              # TypeScript types + node templates
    api.ts                         # Backend API client
    supabase.ts                    # Supabase client

backend/                           # Backend (FastAPI + LangGraph)
  main.py                         # FastAPI app entry
  config.py                       # pydantic-settings
  db.py                           # Supabase client + update_node_state()
  graph/
    pipeline.py                   # LangGraph StateGraph definition
    nodes/
      order_parsing.py            # Stage 1: Gemini Flash parsing
      ingest.py                   # Stage 2: Pexels + FFmpeg + GCS
      hard_gates.py               # Stage 3a: Cloud Vision + Video Intel.
      quality_scoring.py          # Stage 3b: Gemini Flash Vision
      decision_split.py           # Stage 3c: Weighted formula
      search_index.py             # Stage 4: Embeddings + FAISS + DuckDB
      deliver.py                  # Stage 5: Manifest + zip export
  services/
    llm.py                       # Gemini Flash client
    pexels.py                    # Pexels API client
    clip_processing.py           # FFmpeg + download helpers
    storage.py                   # GCS upload/download/signed URLs
    vision.py                    # Cloud Vision API (logos, text)
    video_intelligence.py        # Video Intelligence API (NSFW, labels)
    embeddings.py                # Vertex AI multimodal embeddings
  routes/
    workflows.py                 # REST endpoints
    health.py                    # Health check
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+
- FFmpeg
- GCP account with $300 free credits
- Supabase account (free tier)
- Pexels API key (free)

### Frontend Setup

```bash
cd lumen-ai
cp .env.example .env
# Fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, GCP_PROJECT_ID, PEXELS_API_KEY, etc.
uvicorn main:app --reload
```

### GCP Setup

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com vision.googleapis.com videointelligence.googleapis.com storage.googleapis.com
gcloud iam service-accounts create lumenai-sa
gcloud iam service-accounts keys create sa-key.json --iam-account=lumenai-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
gcloud storage buckets create gs://YOUR_BUCKET --location=us-central1
```

### Database Setup

Run the SQL schema in your Supabase SQL Editor — see `Database Schema` section above.

### Deploy

```bash
# Backend → Cloud Run
cd backend
gcloud run deploy lumenai-backend --source . --region us-central1

# Frontend → Vercel
cd lumen-ai
vercel
```
