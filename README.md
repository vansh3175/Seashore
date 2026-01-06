# Sea Shore 🌊

**High-Fidelity Distributed Studio Architecture**

Sea Shore is a local-first, cloud-native recording pipeline designed to replicate the reliability of local studio recording in a remote environment. Built on the **Next.js 16 App Router**, it leverages **WebRTC** for real-time low-latency communication and **IndexedDB** for progressive local buffering—ensuring lossless quality even during network instability.

By decoupling the live stream from the recording interface, Sea Shore guarantees high-bitrate asset integrity, asynchronously syncing master tracks to **Cloudflare R2** edge storage.

---

## Why Sea Shore?

Traditional remote recording tools prioritize live experience over recording integrity.
Dropped packets, jitter, and reconnects silently degrade the final asset.

Sea Shore inverts this model:
- Live streams are optimized for latency
- Recordings are optimized for fidelity
- Failure is expected and recoverable


## Interface Preview 📸



![Studio Dashboard](/screenshots/studio.png)
*Real-time studio dashboard with low-latency monitoring.*

![Session View](/screenshots/session.png)
*Active session view featuring connection and Meeting.*

![Greenroom](/screenshots/greenroom.png)
*Greenroom / pre-show controls and device checks.*

![Downloads](/screenshots/download.png)
*Download the video feed for each participant .*

---

## Core Architecture & Capabilities 🚀

### 📡 Real-Time WebRTC Mesh
Utilizes **LiveKit** to orchestrate scalable, low-latency audio/video tracks. Handles adaptive bitrate streaming (simulcast), DTX (Discontinuous Transmission), and connection recovery, ensuring a seamless "room" experience without compromising the underlying recording quality.

### 💾 Local-First Persistence (IndexedDB)
Implements a browser-based "store-and-forward" mechanism. Raw media blobs are captured locally via the MediaStream Recording API and written immediately to **IndexedDB**. This prevents data loss during jitter or packet drops, functioning similarly to a local hard drive recording.

### ☁️ Cloudflare R2 Edge Storage
Leverages S3-compatible object storage with zero egress fees. The background worker pipeline manages multi-part uploads, efficiently transferring large `.webm` or `.mp4` assets from the client's local cache to the cloud bucket for permanent archival.


---

## Tech Stack 🛠️

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Server Actions, API Route Handlers |
| **Streaming** | LiveKit (WebRTC) | SFU, Real-time signaling & media transport |
| **Local Storage** | IndexedDB | Browser-side progressive buffering |
| **Cloud Storage** | Cloudflare R2 | S3-compatible asset persistence |
| **Database** | Prisma | Schema management & migrations |
| **Styling** | Tailwind CSS | Utility-first responsive design |

---

## Environment & Setup

Copy `.env.sample` to `.env.local` and fill in required values. The project includes an `.env.sample` with all keys used in code. Minimal required variables:

```
NEXT_PUBLIC_LIVEKIT_URL="wss://your-livekit-host"
LIVEKIT_API_KEY="your_livekit_api_key"
LIVEKIT_API_SECRET="your_livekit_api_secret"
R2_ACCOUNT_ID="your_r2_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="sea-shore-recordings"
R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
CLERK_WEBHOOK_SECRET="whsec_..."
DATABASE_URL="postgresql://user:pass@host:port/db"
```

Start the development server:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

---

## Recovery & Crash Resilience

Sea Shore uses a local-first persistence model to avoid data loss during network failures or crashes:

- Media chunks are buffered in **IndexedDB** (see `utils/db.ts`) as they are captured.
- A dedicated background worker (`workers/upload.worker.ts`) uploads chunks in 5MB multipart parts to Cloudflare R2 and tracks progress in IDB.
- If the browser or machine crashes, the app's `GlobalRecovery` component (`components/GlobalRecovery.tsx`) detects unfinished recordings on startup and allows the user to resume uploads. The worker will reassemble pending chunks and complete the multipart upload, ensuring no recorded data is lost.

This combination of local buffering, durable metadata, and resumable multipart uploads provides robust failure recovery for long recordings.

---

## Project Structure

app/: Server-side Route Handlers & Server Components.

workers/: Background processes for IndexedDB to R2 synchronization.

lib/: Singletons for LiveKit SDK and S3 Client instantiation.

prisma/: Schema definitions.
