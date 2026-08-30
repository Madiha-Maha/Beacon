# Beacon — Real-Time AI Sight Companion

An always-listening, audio-first AI companion (PWA) that streams the phone
camera to a vision-language model in near real-time and speaks
**priority-tiered narration**:

1. **Hazard** (stairs, curb, vehicle, wet floor, obstacle, drop-off…)
2. **Social** (someone waving, approaching, child, service animal…)
3. **Ambient** (static scene context, only after the above)

Additional features:
- **Community Hazard Mesh** — every Beacon user contributes anonymized
  hazard geotags shared with all users in real time.
- **Caregiver Mirror Mode** — a consent-gated, low-bandwidth transcript view
  of what Beacon is narrating.
- **Offline-degraded UX** — the PWA shell and UI remain functional even when
  the backend is unreachable; triage logic can be mocked locally.

Monorepo (pnpm workspaces):

```
beacon/
├── apps/
│   ├── web/   → Next.js 14 App Router PWA (Vercel target)
│   └── api/   → Node.js + Express + socket.io + Prisma (Railway target)
└── packages/
    └── shared/   → shared TypeScript types + zod schemas
```

---

## Quickstart (local development)

### Prerequisites
- Node.js 20+
- pnpm 9+
- A running PostgreSQL instance (or Railway Postgres)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Environment variables
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

- Edit `apps/api/.env` and set `DATABASE_URL` to a reachable Postgres URL
  (local or Railway).
- Generate a long random string for `JWT_SECRET`.
- Set `VISION_PROVIDER` to one of `mock | openai | anthropic` and provide
  the matching `VISION_PROVIDER_API_KEY`. The default `mock` provider does
  **not** require a key and cycles through synthetic scene analyses so you
  can develop the full round trip without burning API credits.

### 3. Database
```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
```

### 4. Run both apps
```bash
# from the repo root
pnpm dev
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:4000/health (should return `{status:"ok"}`)

Open the frontend on a real phone (forward the port or use ngrok) to exercise
camera + geolocation + vibration APIs. Desktop browsers work for UI work but
camera frames will be empty until you grant permissions.

---

## End-to-end round trip (what to verify locally)

1. Open http://localhost:3000, step through onboarding → **Live**.
2. Tap the amber button. The browser should request camera permission,
   stream frames every ~1.8s over the WebSocket to `/frame:send`, and you
   should see `narration:receive` events arrive in DevTools → Network → WS.
3. SpeechSynthesis should speak the narration; `navigator.vibrate()` should
   fire the distinct hazard/social patterns.
4. **Settings → Report a hazard** should `POST /hazards` and the entry should
   appear on **Hazard map → Locate me** within the selected radius.
5. **Settings → Caregiver links**: create a link → **Grant consent** → open
   the Mirror Mode preview and confirm the transcript loads.

---

## Production deployment

These steps match the configs baked into `apps/api/railway.json`,
`apps/api/Procfile`, and `apps/web/vercel.json` exactly.

### 1. Push the repo to GitHub

```bash
git init && git add -A && git commit -m "Beacon initial scaffold"
gh repo create beacon --private --source=. --push
```

### 2. Railway (backend + Postgres)

1. Railway → **New Project → Deploy from GitHub** → pick your repo.
2. **Service settings → Root directory** → set to `apps/api`.
3. Railway → **Add plugin → PostgreSQL**. The plugin auto-injects
   `DATABASE_URL` so you do **not** need to set it manually.
4. **Variables** — set:
   - `JWT_SECRET` (long random string, e.g. `openssl rand -hex 48`)
   - `CORS_ORIGIN` → start with `http://localhost:3000`; after Vercel step 3
     append the final domain comma-separated.
   - `VISION_PROVIDER` → `openai | anthropic | mock`
   - `VISION_PROVIDER_API_KEY` (unless `mock`)
   - `PORT` → `4000` (default; Railway overrides at runtime anyway)
5. **Deploy**. The build command runs
   `pnpm install && pnpm --filter shared build && pnpm --filter api build && pnpm --filter api exec prisma migrate deploy`.
6. Confirm `GET https://<railway-url>/health` returns `{status:"ok"}`.
7. Copy the public `https://…` Railway URL and derive `wss://…` from it (same
   host, swap protocol).

### 3. Vercel (PWA frontend)

1. Vercel → **Add New → Project** → the same repo.
2. **Root directory** → set to `apps/web`. The preset detects Next.js.
   `vercel.json` overrides install/build commands to run at workspace root.
3. **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL` → the Railway HTTPS URL from step 2.7
   - `NEXT_PUBLIC_WS_URL` → the Railway WSS URL from step 2.7
4. **Deploy**. After the first build succeeds, copy the final Vercel domain.

### 4. Tighten CORS on Railway

Back on Railway → Variables → update `CORS_ORIGIN` to
`https://beacon.vercel.app,http://localhost:3000` (swap in your real Vercel
domain). **Redeploy** the API service.

### 5. Real-phone smoke test

1. On a phone, open the Vercel URL → Safari/Chrome → **Add to Home Screen**.
2. Open the PWA from the home screen (this runs the service worker +
   standalone mode).
3. Grant **camera**, **microphone** (not used today, required for future
   voice commands), and **location** permissions.
4. Go to **Live**, tap the amber button, and walk toward a curb or stair:
   camera frame → base64 JPEG → WebSocket → vision provider → triage engine
   → SpeechSynthesis should speak a short, hazard-first sentence.

---

## API / Socket contract

### HTTP
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create an account (`{email, password}`) |
| POST | `/auth/login`    | Returns `{accessToken, user}` |
| GET  | `/auth/me`       | Authenticated user profile |
| POST | `/hazards`       | Report a hazard (optional auth) |
| GET  | `/hazards?lat&lng&radiusKm` | Nearby hazard mesh query |
| POST | `/caregiver/link` | Create a pending caregiver link |
| POST | `/caregiver/link/:id/grant` | User grants consent |
| POST | `/caregiver/link/:id/revoke` | User revokes consent |
| GET  | `/caregiver/links` | List user's links |
| GET  | `/caregiver/:id/transcript` | Mirror Mode transcript (consent-gated; pass `x-beacon-transcript-token` header or a user JWT) |
| GET  | `/health` | Railway health check → `{status:"ok"}` |

### Socket.IO
- Client → server: `frame:send { frame: <base64 jpeg>, geolocation?: {lat,lng} }`
- Server → client: `narration:receive { tier, text, hapticPattern? }`
- Server → client: `narration:error { message }`
- Caregiver subscriber: emit `caregiver:subscribe { linkId }` → receive
  `caregiver:transcript` broadcast events.

### Vision provider (pluggable)
`apps/api/src/services/vision.service.ts` exports a
`VisionProvider` interface and `createVisionProvider()` factory
(`openai | anthropic | mock`). The rest of the app only imports
`vision.analyzeFrame(base64)` — swapping vendors is a one-line env change,
never edit socket or route code to switch models.

### Triage engine (core IP)
`apps/api/src/services/triage.service.ts` implements real, deterministic
priority logic on top of vision labels — not a passthrough to the LLM:
- Hazard keywords detected → always outranks social/ambient
- Scoring considers critical-hazard subset + proximity (near > approaching)
- Haptic patterns mapped deterministically
- Hazard narration capped at one short sentence so TTS delivers quickly

Per-tier debounces in the socket (hazards 1.5s, social 3.5s, ambient 7s)
prevent chatter while ensuring hazards always interrupt.

---

## Haptic language (documented product spec)

| Pattern | When | Vibration |
|---|---|---|
| `hazard-near` | Curb at your feet, wet floor sign 1 m away, stair top, door directly ahead | `[80, 40, 80]` — two strong pulses |
| `hazard-approaching` | Car, bicycle, person walking toward you | `[40, 60, 40, 60, 40]` — pulsing cadence |
| `social-cue` | Friend waves, someone approaches, service dog near | `[30, 50, 30]` — gentle pair |

Haptics are always paired with speech; never rely on vibration alone.

---

## Deployment config in-code (verified matches spec)

`apps/api/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ../.. && pnpm install && pnpm --filter shared build && pnpm --filter api build && pnpm --filter api exec prisma migrate deploy"
  },
  "deploy": {
    "startCommand": "pnpm --filter api start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

`apps/api/Procfile`:
```
web: node dist/index.js
```

`apps/web/vercel.json`:
```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm --filter shared build && pnpm --filter web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

---

## Post-deploy dashboard-only steps (can't be done from code)

These must be clicked through manually in the Railway/Vercel UIs after first
deploy:

### Railway
1. **Postgres plugin** must be added from the *+ New → Plugin* picker in the
   project UI; plugins cannot be declared in `railway.json`.
2. **Custom domain** (optional, recommended) — Settings → Domains → add
   `api.beacon.example.com` and point a CNAME at Railway-provided host.
   Update `CORS_ORIGIN` + the two Vercel env vars to use your custom domain.
3. **Automatic deploys branch** — Settings → Source → make sure it tracks
   `main` / `master` only.
4. **Restart policy** is set in `railway.json` but double-check the UI under
   Deploy → Restart Policy.

### Vercel
1. **Custom domain** (required for PWA install) — Settings → Domains → add
   `beacon.example.com`. Update `CORS_ORIGIN` on Railway to include it.
2. **Environment Variables** — mark `NEXT_PUBLIC_*` as *Public* so they bake
   into the production bundle correctly (they already are; just confirm in
   UI).
3. **Deployment protection** — turn *off* Vercel Password Protection and
   Vercel Authentication for production; otherwise `CORS_ORIGIN` + WSS
   connection attempts from the PWA will be blocked.
4. **Function region** — set to the same region as your Railway Postgres for
   lowest latency (`iad1`/`us-east-1` is a sensible default).

### Both platforms
1. Hook up your domain **DNS** records; SSL is issued automatically.
2. Set up **monitoring / alerts**: Railway → Monitoring, Vercel → Analytics
   (or plug Datadog/Sentry).

---

## Project structure

```
beacon/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .gitignore
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── vercel.json
│   │   ├── .env.example
│   │   ├── public/
│   │   │   ├── manifest.webmanifest
│   │   │   └── sw.js
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                     (onboarding + auth)
│   │   │   ├── live/page.tsx
│   │   │   ├── hazard-map/page.tsx
│   │   │   ├── caregiver/[linkId]/page.tsx  (Mirror Mode)
│   │   │   └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── ListeningIndicator.tsx
│   │   │   ├── NarrationStreamHandler.tsx   (getUserMedia + socket + TTS + haptics)
│   │   │   └── HazardMapView.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   └── store.ts                     (zustand, persisted)
│   │   └── styles/globals.css
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── railway.json
│       ├── Procfile
│       ├── .env.example
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/20260830000001_init/migration.sql
│       └── src/
│           ├── index.ts
│           ├── routes/
│           │   ├── auth.routes.ts
│           │   ├── hazards.routes.ts
│           │   └── caregiver.routes.ts
│           ├── services/
│           │   ├── vision.service.ts        (pluggable VisionProvider)
│           │   └── triage.service.ts        (priority logic)
│           ├── middleware/
│           │   ├── auth.middleware.ts
│           │   └── error.middleware.ts
│           └── sockets/narration.socket.ts
└── packages/shared/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── types.ts
        └── schemas.ts                      (zod)
```
