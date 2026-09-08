# Beacon — Real-Time AI Sight Companion

> Always-listening, audio-first AI companion for blind and low-vision users. Streams camera frames in near real-time, prioritizing immediate hazards, social cues, and ambient details with audio narration, haptic feedback, a crowdsourced hazard mesh, and a caregiver mirror mode.

---

## 🚀 DEPLOYMENT STEPS (Railway + Vercel)

Follow these exact steps to deploy Beacon to production:

1. **Push repository to GitHub**:
   ```bash
   git add .
   git commit -m "feat: beacon real-time companion"
   git push origin main
   ```

2. **Railway (Backend API + Socket.IO + PostgreSQL)**:
   - Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
   - Set **Service Root** to `apps/api` (or project root with Railway config).
   - Add the **PostgreSQL** plugin.
   - Set Environment Variables:
     - `DATABASE_URL` (automatically linked from Postgres plugin)
     - `JWT_SECRET` (generate a strong random secret)
     - `CORS_ORIGIN` (e.g. `https://beacon.vercel.app,http://localhost:3000`)
     - `VISION_PROVIDER_API_KEY` or `GEMINI_API_KEY` (from Google AI Studio)
     - `PORT=4000` (or Railway dynamic `$PORT`)
   - Deploy and confirm `/health` returns `{"status":"ok"}`.
   - Copy the public service URL (e.g., `https://beacon-api.up.railway.app`) and its WebSocket equivalent (`wss://beacon-api.up.railway.app`).

3. **Vercel (Frontend PWA)**:
   - Go to [Vercel](https://vercel.com) → **New Project** → import the same GitHub repository.
   - Root directory: `apps/web` (or root).
   - Configure Environment Variables:
     - `NEXT_PUBLIC_API_BASE_URL` = your Railway URL (`https://beacon-api.up.railway.app`)
     - `NEXT_PUBLIC_WS_URL` = your Railway WebSocket URL (`wss://beacon-api.up.railway.app`)
   - Deploy.

4. **Update CORS on Railway**:
   - In Railway service settings, update `CORS_ORIGIN` to your final production Vercel domain (e.g. `https://beacon-production.vercel.app`).
   - Redeploy or trigger restart.

5. **Device Verification**:
   - Open the web app on an iOS or Android smartphone.
   - Tap **"Add to Home Screen"** to install as a standalone PWA.
   - Grant **Camera**, **Microphone**, and **Geolocation** permissions.
   - Test end-to-end loop: camera snapshot → vision inference → triage priority → speech synthesis + haptic vibration.

---

## 🎨 DESIGN SYSTEM SPECIFICATION

- **Background Palette**: `#0B0E11` near-black (reduces OLED battery consumption and glare)
- **Primary Accent**: `#FFB84C` high-contrast amber (highest luminance readability for low-vision eyes)
- **High-Contrast Mode**: `#000000` deep black + `#FFE600` ultra-high contrast safety yellow
- **Typography**: `Atkinson Hyperlegible` (specifically crafted for low-vision distinction)
- **Haptic Language**:
  - `hazard-near`: `[250ms pulse, 100ms pause, 250ms pulse, 100ms pause, 500ms firm buzz]`
  - `hazard-approaching`: `[150ms, 150ms, 150ms]`
  - `social-cue`: `[80ms light tap, 80ms light tap]`
- **Triage Priority Hierarchy**:
  1. `hazard` (immediate trip, drop-off, oncoming vehicle, construction)
  2. `social` (approaching person, waving friend, gesture)
  3. `ambient` (level pathway, lighting, entrance context)
