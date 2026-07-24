# ⚡ Zero-Cloud — Offline Codebase Onboarding & Semantic Search Engine

> **Built for the Supermemory Local Hackathon (July 9–13)**  
> *Privacy-First, 100% Offline Codebase Indexing & Semantic Search Powered by Supermemory Local (`localhost:6767`).*

---

## 🏆 Hackathon Context: Supermemory Local Hackathon

This project was built from scratch for the **Supermemory Local Hackathon** — a 5-day async hackathon centered on building local, privacy-preserving AI applications powered by the offline Supermemory memory layer.

### 📜 Hackathon Overview & Rules
* **Theme**: Build anything that meaningfully utilizes **Supermemory Local**.
* **Core Requirement**: 100% local memory processing, embeddings, storage, and semantic search without external cloud dependencies.
* **Dates**: July 9–13

---

## 💡 What is Zero-Cloud?

**Zero-Cloud** is an offline, privacy-first codebase onboarding and semantic search engine. It enables developers and teams to instantly index, search, and query massive local source code repositories without leaking sensitive code, proprietary business logic, or internal credentials to cloud AI services.

By running **Supermemory Local** natively on your machine via Docker (`0.0.0.0:8000` mapped to `localhost:6767`), Zero-Cloud chunks code files, generates vector embeddings, creates persistent semantic memories, and exposes a high-speed semantic search API through a dark-mode web dashboard.

---

## 🚀 Key Features

- **🔒 100% Offline & Privacy-First**: All embeddings, code chunks, and vector memory indexes reside locally on your machine. Zero cloud telemetry.
- **📂 Intelligent Local Code Crawler**: Recursively scans directories while automatically filtering out build artifacts (`node_modules`, `.git`, `dist`, lockfiles, binary files, images, etc.).
- **🧩 Smart Code Chunker**: Breakdown files into semantically coherent code blocks with precise line markers (`lineStart`, `lineEnd`), language identification, and filepath metadata.
- **🏷️ Container Tag Isolation (Namespaces)**: Provides complete boundary isolation by container tags (`containerTag`). Index multiple projects independently without cross-repository search pollution. Automatically flushes old indexes when re-indexing a container scope.
- **🔍 Dual-Engine Semantic Search (`v4` + `v3` Fallback)**: Queries Supermemory Local using high-level memory search (`v4/search`) with fallback to raw vector search (`v3/search`), returning exact matches with file paths, line ranges, and similarity relevance scores.
- **🖥️ Modern OLED/Cyberpunk UI**: Sleek, responsive React frontend with query suggestions, live indexing feedback, and code snippet result views.

---

## 🏗️ Architecture & Workflow

```
[ Local File System ] ──▶ [ Crawler & Chunker ] ──▶ [ Express Backend ]
                                                           │
                                                           ▼
                                                [ Supermemory Local ]
                                              (Docker: 0.0.0.0:8000)
                                                           │
                                                           ▼
[ Modern React UI ] ◄─────── [ v4/v3 Hybrid Search ] ──────┘
```

1. **Crawl**: The backend service recursively scans the absolute folder path provided via the UI.
2. **Chunk**: Code is split into overlapping chunks, tagged with metadata (`filePath`, `language`, `lineStart`, `lineEnd`).
3. **Index**: Chunks are uploaded to Supermemory Local under a specific `containerTag`.
4. **Query & Search**: User queries are matched against local vector embeddings and semantic memory indexes to yield formatted code snippets.

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Memory Engine Client**: `supermemory` JS SDK & REST Fetch API
- **Utilities**: `ignore` (for `.gitignore` rules matching)

### **Frontend**
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (Vanilla OLED/Dark Aesthetics)
- **Icons & Tooling**: Oxlint, Native Web APIs

### **AI & Vector Storage**
- **Memory Engine**: Supermemory Local (`ubuntu:latest` container / `supermemory-server` binary)
- **Embedding Model**: `Xenova/bge-base-en-v1.5` (768 dimensions, run locally)

---

## 📦 Getting Started & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ 
- [Docker Desktop](https://www.docker.com/) (running locally)
- [Git](https://git-scm.com/)

---

### Step 1: Start Supermemory Local Engine

Run the official Supermemory Local container on port `8000` (mapped locally):

```bash
docker run -d --name supermemory-server -p 8000:6767 supermemory/supermemory-server:latest
```

*Or verify your running container:*
```bash
docker ps
```
Ensure `0.0.0.0:8000->6767/tcp` is active.

---

### Step 2: Configure & Start the Backend

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in `backend/.env`:
   ```env
   PORT=3000
   SUPERMEMORY_BASE_URL=http://localhost:8000
   SUPERMEMORY_API_KEY=local_development_key
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```
   *The backend will boot on `http://localhost:3000`.*

---

### Step 3: Start the Frontend UI

1. Open a new terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`.

---

## 🎯 How to Use Zero-Cloud

1. **Provide Codebase Path**: In the **Index Repository** section, enter the absolute path to any local project directory (e.g. `D:\projects\my-app`).
2. **Assign Container Tag**: Enter a unique identifier for the repository boundary (e.g. `my_app_v1`).
3. **Index Directory**: Click **Index Directory**. The engine will scan, chunk, and index the entire codebase into Supermemory Local in seconds.
4. **Search Codebase**: Type natural language queries into the search bar (e.g. *"Where is authentication handled?"* or *"How does database routing work?"*).
5. **Inspect Snippets**: View exact file paths, line ranges, language badges, and similarity scores directly in the UI.

---

## 📡 API Endpoints

### `POST /api/index-repo`
Crawls a directory, clears any existing index for the given `containerTag`, and uploads code chunks to Supermemory.

**Request Body:**
```json
{
  "repoPath": "D:\\Brainstorm\\my-project",
  "containerTag": "my_project_scope"
}
```

### `POST /api/search`
Performs semantic search across memories and vector chunks for a specific container tag scope.

**Request Body:**
```json
{
  "query": "vitest setup configuration",
  "containerTag": "my_project_scope"
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "The test setup file mocks the Prisma Client with vi.fn()",
      "filePath": "src/__tests__/setup.ts",
      "language": "typescript",
      "lineStart": 1,
      "lineEnd": 150,
      "score": 0.848
    }
  ]
}
```

---

## 📌 How Zero-Cloud Uses Supermemory Local (Submission Summary)

Zero-Cloud leverages **Supermemory Local** as an offline vector memory store and semantic search engine. When a local repository is indexed, code files are chunked into structured blocks and pushed to Supermemory Local via `POST /v3/documents`. Supermemory Local generates local embeddings (`bge-base-en-v1.5`) and stores persistent semantic memories. During search, Zero-Cloud queries Supermemory's `/v4/search` memory layer with container tag scope isolation, fetching matching code snippets, exact file paths, line numbers, and relevance scores entirely on-device without cloud connectivity.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<p center="align">
  Built with ❤️ for the <b>Supermemory Local Hackathon</b>
</p>
