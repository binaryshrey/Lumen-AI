export type AgentStatus = "idle" | "running" | "completed" | "error"

export type AgentNodeData = {
  id: string
  tag: string
  tagColor: "green" | "blue" | "purple" | "amber" | "rose"
  title: string
  subtitle: string
  icon: string // icon key
  status: AgentStatus
  outputLabel: string
  outputPreview: string
  duration: number // seconds
  metric: { label: string; value: string }
  children?: AgentNodeData[]
  drawer: {
    tabs: string[]
    overview: {
      description: string
      inputs: { label: string; value: string }[]
      outputs: { label: string; value: string }[]
    }
    config: { label: string; description: string; type: "text" | "slider" | "toggle" | "select"; value: string }[]
  }
}

export type Workflow = {
  id: string
  description: string
  targetMinutes: number
  status: AgentStatus
  nodes: AgentNodeData[]
  currentNodeIndex: number
  createdAt: number
}

type NodeTemplate = Omit<AgentNodeData, "status" | "duration" | "children"> & {
  children?: Omit<AgentNodeData, "status" | "duration">[]
}

export const PIPELINE_NODES: NodeTemplate[] = [
  {
    id: "order-parsing",
    tag: "LLM Parser",
    tagColor: "amber",
    title: "Order Parsing",
    subtitle: "Sonnet 4.6 — Prompt Interpreter",
    icon: "brain",
    outputLabel: "PARSED SPEC",
    outputPreview: "Extracting keywords, thresholds, and filter configuration from prompt...",
    metric: { label: "TOKENS", value: "—" },
    drawer: {
      tabs: ["Overview", "Config", "Output"],
      overview: {
        description:
          "Parses the user's natural language dataset request into a structured specification using Claude Sonnet 4.6. Derives Pexels search keywords and sets filter thresholds based on qualitative intent.",
        inputs: [
          { label: "Model", value: "claude-sonnet-4-6-20250514" },
          { label: "Temperature", value: "0" },
          { label: "Max Tokens", value: "1024" },
        ],
        outputs: [
          { label: "Keywords", value: "Derived Pexels search terms" },
          { label: "Thresholds", value: "Aesthetic, semantic, sharpness, motion" },
          { label: "Quality Tier", value: "standard / high / cinematic" },
        ],
      },
      config: [
        { label: "Temperature", description: "Controls randomness — lower values produce more deterministic parsing.", type: "slider", value: "0" },
        { label: "Quality Tier", description: "Sets baseline threshold presets for downstream filters.", type: "select", value: "standard" },
      ],
    },
  },
  {
    id: "ingest",
    tag: "Data Ingest",
    tagColor: "amber",
    title: "Ingest",
    subtitle: "Pexels Fetch + FFmpeg Decode",
    icon: "download",
    outputLabel: "FETCHED",
    outputPreview: "Fetching video clips from Pexels and extracting frames via FFmpeg...",
    metric: { label: "CLIPS", value: "—" },
    drawer: {
      tabs: ["Overview", "Config", "Output"],
      overview: {
        description:
          "Fetches video clips from Pexels API using derived keywords, decodes frames via FFmpeg (1 frame/sec), and deduplicates using a Bloom filter on clip URLs.",
        inputs: [
          { label: "Source", value: "Pexels Video API" },
          { label: "Frame Rate", value: "1 frame/sec" },
          { label: "Dedup", value: "Bloom filter (mmh3)" },
        ],
        outputs: [
          { label: "Clips", value: "Raw video files in GCS" },
          { label: "Frames", value: "Extracted JPEG frames" },
          { label: "Metadata", value: "Duration, resolution, source URL" },
        ],
      },
      config: [
        { label: "Max Pages", description: "Maximum Pexels API pages to crawl per keyword.", type: "text", value: "5" },
        { label: "Frames Per Second", description: "Number of frames to extract from each clip.", type: "slider", value: "1" },
        { label: "Dedup Enabled", description: "Skip clips with URLs already seen in prior workflows.", type: "toggle", value: "true" },
      ],
    },
  },
  {
    id: "ml-filters",
    tag: "Quality Filter",
    tagColor: "amber",
    title: "ML Filters",
    subtitle: "Gate → Score → Decide",
    icon: "filter",
    outputLabel: "FILTERED",
    outputPreview: "Running hard gates then quality scoring pipeline...",
    metric: { label: "ACCEPT RATE", value: "—" },
    children: [
      {
        id: "ml-hard-gates",
        tag: "Hard Gate",
        tagColor: "amber",
        title: "Hard Gates",
        subtitle: "Sharpness + Safety Check",
        icon: "shield",
        outputLabel: "GATED",
        outputPreview: "Rejecting blurry frames (Laplacian < 0.1) and unsafe content before scoring...",
        metric: { label: "REJECTED", value: "—" },
        drawer: {
          tabs: ["Overview", "Config", "Output"],
          overview: {
            description:
              "Fast, cheap rejection filters that run before expensive API calls. Sharpness uses OpenCV Laplacian variance (~5ms, CPU). Safety uses Sonnet 4.6 vision for NSFW detection.",
            inputs: [
              { label: "Sharpness", value: "OpenCV cv2.Laplacian variance" },
              { label: "Safety", value: "Sonnet 4.6 vision — NSFW pass/fail" },
            ],
            outputs: [
              { label: "Pass", value: "Clips forwarded to quality scoring" },
              { label: "Reject", value: "Blurry or unsafe clips discarded" },
            ],
          },
          config: [
            { label: "Sharpness Threshold", description: "Minimum Laplacian variance score. Below this = rejected as blurry.", type: "slider", value: "0.1" },
            { label: "Safety Enabled", description: "Run NSFW safety check via Sonnet 4.6 vision.", type: "toggle", value: "true" },
          ],
        },
      },
      {
        id: "ml-quality-scoring",
        tag: "Scorer",
        tagColor: "amber",
        title: "Quality Scoring",
        subtitle: "Aesthetic + Semantic + Motion",
        icon: "sparkles",
        outputLabel: "SCORED",
        outputPreview: "Scoring clips on aesthetic quality, semantic relevance, and motion intensity...",
        metric: { label: "AVG SCORE", value: "—" },
        drawer: {
          tabs: ["Overview", "Config", "Output"],
          overview: {
            description:
              "Runs parallel quality scorers on each clip. Aesthetic and semantic match scored via single Sonnet 4.6 vision call. Motion scored locally via OpenCV Farneback optical flow. Captions generated in the same LLM call.",
            inputs: [
              { label: "Aesthetic", value: "Sonnet 4.6 vision — visual quality 0–1" },
              { label: "Semantic", value: "Sonnet 4.6 vision — match to order description 0–1" },
              { label: "Motion", value: "OpenCV optical flow — movement intensity 0–1" },
              { label: "Caption", value: "Sonnet 4.6 vision — 2-sentence description" },
            ],
            outputs: [
              { label: "Scores", value: "Per-clip scores for each dimension" },
              { label: "Caption", value: "Generated text description" },
            ],
          },
          config: [
            { label: "Aesthetic Weight", description: "Weight in the combined score formula.", type: "slider", value: "0.35" },
            { label: "Semantic Weight", description: "Weight for relevance to order description.", type: "slider", value: "0.30" },
            { label: "Sharpness Weight", description: "Weight for image clarity score.", type: "slider", value: "0.20" },
            { label: "Motion Weight", description: "Weight for movement intensity.", type: "slider", value: "0.15" },
          ],
        },
      },
      {
        id: "ml-decision",
        tag: "Decision",
        tagColor: "amber",
        title: "Decision Split",
        subtitle: "Accept / Margin / Reject",
        icon: "git-branch",
        outputLabel: "DECIDED",
        outputPreview: "Applying weighted formula and thresholds to route clips...",
        metric: { label: "ACCEPT RATE", value: "—" },
        drawer: {
          tabs: ["Overview", "Config", "Output"],
          overview: {
            description:
              "Combines all quality scores using a weighted formula and applies threshold gates to split clips into three buckets: accept (→ index), margin (→ human QA queue), or reject (→ discard).",
            inputs: [
              { label: "Formula", value: "0.35×aesthetic + 0.30×semantic + 0.20×sharpness + 0.15×motion" },
            ],
            outputs: [
              { label: "Accept", value: "Score > 0.55 → forwarded to indexing" },
              { label: "Margin", value: "0.35–0.55 → routed to QA queue" },
              { label: "Reject", value: "Score < 0.35 → discarded" },
            ],
          },
          config: [
            { label: "Accept Threshold", description: "Weighted score above which clips are automatically accepted.", type: "slider", value: "0.55" },
            { label: "Margin Threshold", description: "Score below which clips are rejected. Between this and accept = margin.", type: "slider", value: "0.35" },
          ],
        },
      },
    ],
    drawer: {
      tabs: ["Overview", "Config", "Output"],
      overview: {
        description:
          "Runs a three-stage filter pipeline: hard gates reject cheaply, quality scorers produce weighted scores, and the decision node routes clips to accept / margin / reject.",
        inputs: [
          { label: "Hard Gates", value: "Sharpness (OpenCV), Safety (Sonnet 4.6)" },
          { label: "Soft Scorers", value: "Aesthetic, Semantic, Motion, Caption" },
          { label: "Formula", value: "0.35×aesthetic + 0.30×semantic + 0.20×sharpness + 0.15×motion" },
        ],
        outputs: [
          { label: "Accept", value: "Score > 0.55 → Index" },
          { label: "Margin", value: "0.35–0.55 → QA queue" },
          { label: "Reject", value: "Score < 0.35 → Discard" },
        ],
      },
      config: [
        { label: "Sharpness Threshold", description: "Minimum Laplacian variance score to pass the hard gate.", type: "slider", value: "0.1" },
        { label: "Accept Threshold", description: "Weighted score above which clips are automatically accepted.", type: "slider", value: "0.55" },
        { label: "Margin Threshold", description: "Weighted score below which clips are rejected. Between this and accept = margin.", type: "slider", value: "0.35" },
      ],
    },
  },
  {
    id: "search-index",
    tag: "Vector Search",
    tagColor: "amber",
    title: "Search & Index",
    subtitle: "CLIP Embed + FAISS + DuckDB",
    icon: "database",
    outputLabel: "INDEXED",
    outputPreview: "Generating CLIP embeddings, building FAISS vector index, writing Parquet metadata...",
    metric: { label: "INDEXED", value: "—" },
    drawer: {
      tabs: ["Overview", "Config", "Output"],
      overview: {
        description:
          "Generates CLIP ViT-L/14 embeddings for accepted clips, indexes them in FAISS (HNSW) for semantic search, writes structured metadata to DuckDB/Parquet for range queries, and indexes captions in Elasticsearch for text search.",
        inputs: [
          { label: "Embedding Model", value: "CLIP ViT-L/14 (768-dim)" },
          { label: "Vector Index", value: "FAISS IndexHNSWFlat" },
          { label: "Columnar Store", value: "DuckDB + Parquet" },
        ],
        outputs: [
          { label: "Embeddings", value: "768-dim vectors per clip" },
          { label: "FAISS Index", value: "Searchable ANN index" },
          { label: "Metadata", value: "Scores, captions, attributes" },
        ],
      },
      config: [
        { label: "HNSW M", description: "Number of bi-directional links per node. Higher = better recall, more memory.", type: "text", value: "32" },
        { label: "HNSW ef_search", description: "Search-time beam width. Higher = better recall, slower query.", type: "text", value: "200" },
      ],
    },
  },
  {
    id: "deliver",
    tag: "Dataset Export",
    tagColor: "amber",
    title: "Deliver",
    subtitle: "Package Manifest + Export",
    icon: "package",
    outputLabel: "DELIVERED",
    outputPreview: "Packaging accepted clips into manifest, computing quality summary, preparing export...",
    metric: { label: "DURATION", value: "—" },
    drawer: {
      tabs: ["Overview", "Config", "Output"],
      overview: {
        description:
          "Packages all accepted clips into a downloadable dataset with a JSON manifest containing clip metadata, quality scores, and signed URLs. Computes a quality summary with average scores and diversity metrics.",
        inputs: [
          { label: "Source", value: "Accepted clips from index" },
          { label: "Format", value: "JSON manifest + signed GCS URLs" },
          { label: "Sampling", value: "MMR diversity sampling" },
        ],
        outputs: [
          { label: "Manifest", value: "manifest.json with clip list" },
          { label: "Summary", value: "Avg scores, total duration, clip count" },
          { label: "Download", value: "Signed URL for packaged dataset" },
        ],
      },
      config: [
        { label: "MMR Lambda", description: "Relevance vs diversity tradeoff. Higher = more relevant, lower = more diverse.", type: "slider", value: "0.7" },
        { label: "Include Captions", description: "Include AI-generated captions in the manifest.", type: "toggle", value: "true" },
      ],
    },
  },
]
