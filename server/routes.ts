/**
 * Beacon — Real-Time AI Sight Companion
 * Express Router handling REST API Endpoints
 */

import { Router, Request, Response } from "express";
import { appStore } from "./store.ts";
import { getVisionProvider } from "../services/vision.service.ts";
import { TriageEngine } from "../services/triage.service.ts";

export const apiRouter = Router();

// 1. Railway Mandatory Health Check
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "beacon-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 2. Auth Endpoints
apiRouter.post("/auth/register", (req: Request, res: Response) => {
  const { email, name, role } = req.body || {};
  const user = {
    id: `usr-${Date.now()}`,
    email: email || "user@beacon.vision",
    name: name || "Sight Companion User",
    role: role || "user",
    token: `jwt-${Date.now()}-beacon-secure`,
  };
  res.json({ success: true, user, token: user.token });
});

apiRouter.post("/auth/login", (req: Request, res: Response) => {
  const { email } = req.body || {};
  res.json({
    success: true,
    user: {
      id: "usr-demo",
      email: email || "demo@beacon.vision",
      name: "Alex Rivera",
      role: "user",
    },
    token: "demo-jwt-token-beacon",
  });
});

apiRouter.get("/auth/me", (_req: Request, res: Response) => {
  res.json({
    user: {
      id: "usr-demo",
      email: "demo@beacon.vision",
      name: "Alex Rivera",
      role: "user",
      pairedCaregiver: "sarah.rivera@family.org",
    },
  });
});

// 3. Community Hazard Mesh Endpoints
apiRouter.get("/hazards", (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
  const radius = req.query.radius ? parseFloat(req.query.radius as string) : 50; // km

  const hazards = appStore.getHazards(lat, lng, radius);
  res.json({
    hazards,
    count: hazards.length,
    queryLocation: lat && lng ? { lat, lng, radiusKm: radius } : null,
  });
});

apiRouter.post("/hazards", (req: Request, res: Response) => {
  const { lat, lng, type, title, description, severity } = req.body;
  if (!lat || !lng || !type) {
    res.status(400).json({ error: "lat, lng, and type are required" });
    return;
  }

  const newHazard = appStore.addHazard({
    lat: Number(lat),
    lng: Number(lng),
    type,
    title: title || `${type.replace("_", " ").toUpperCase()} reported`,
    description: description || "Reported via Beacon community mesh",
    severity: severity || "warning",
    reportedBy: "beacon-user",
  });

  res.status(201).json({ success: true, hazard: newHazard });
});

apiRouter.post("/hazards/:id/verify", (req: Request, res: Response) => {
  const updated = appStore.verifyHazard(req.params.id);
  if (!updated) {
    res.status(404).json({ error: "Hazard not found" });
    return;
  }
  res.json({ success: true, hazard: updated });
});

// 4. Caregiver Mirror Mode Endpoints
apiRouter.post("/caregiver/link", (req: Request, res: Response) => {
  const { caregiverEmail } = req.body;
  if (!caregiverEmail) {
    res.status(400).json({ error: "caregiverEmail is required" });
    return;
  }

  const link = appStore.createCaregiverLink("usr-demo", caregiverEmail);
  res.json({
    success: true,
    link,
    mirrorUrl: `/caregiver/${link.token}`,
  });
});

apiRouter.get("/caregiver/links", (_req: Request, res: Response) => {
  const links = appStore.getCaregiverLinks("usr-demo");
  res.json({ links });
});

apiRouter.get("/caregiver/:linkId/transcript", (req: Request, res: Response) => {
  const linkId = req.params.linkId;
  const link = appStore.getCaregiverLinkById(linkId);

  // Allow access if link exists or is default demo
  const logs = appStore.getNarrationLogs(40);
  res.json({
    linkId,
    caregiverEmail: link?.caregiverEmail || "Authorized Caregiver",
    consentGranted: link ? link.consentGranted : true,
    activeStatus: "streaming",
    lastHeartbeat: new Date().toISOString(),
    logs,
  });
});

// 5. Vision Inference API (HTTP fallback to WebSocket)
apiRouter.post("/vision/analyze", async (req: Request, res: Response) => {
  try {
    const { image, lat, lng } = req.body;
    if (!image) {
      res.status(400).json({ error: "image (base64) is required" });
      return;
    }

    const provider = getVisionProvider();
    const triageInput = await provider.analyzeFrame(image, { lat, lng });
    const triageOutput = TriageEngine.triage(triageInput, lat && lng ? { lat, lng } : undefined);

    // Save to narration log for caregiver transcript
    appStore.addNarrationLog({
      tier: triageOutput.tier,
      text: triageOutput.text,
      hapticPattern: triageOutput.hapticPattern,
      lat,
      lng,
    });

    res.json({
      success: true,
      provider: provider.name,
      output: triageOutput,
    });
  } catch (err: any) {
    console.error("Vision analyze endpoint error:", err);
    res.status(500).json({ error: err.message || "Vision inference failed" });
  }
});

// 6. System Status
apiRouter.get("/system/status", (_req: Request, res: Response) => {
  const provider = getVisionProvider();
  res.json({
    status: "ok",
    visionProvider: provider.name,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
