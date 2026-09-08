/**
 * Beacon — Real-Time AI Sight Companion
 * Full-Stack Express Server with Socket.IO & Vite Integration
 */

import express, { Request, Response } from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/routes.ts";
import { getVisionProvider } from "./services/vision.service.ts";
import { TriageEngine } from "./services/triage.service.ts";
import { appStore } from "./server/store.ts";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // CORS headers for local/Vercel connectivity
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Mandatory Top-Level Railway Health Check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "beacon-sight-companion",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount REST API
  app.use("/api", apiRouter);
  // Also support direct /hazards, /caregiver, /auth prefixes matching the cursor prompt contract
  app.use(apiRouter);

  // Setup Socket.IO Server
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 2e7, // 20 MB max payload for video frame snapshots
  });

  io.on("connection", (socket) => {
    console.log(`[Beacon Socket] Client connected: ${socket.id}`);

    // Join caregiver room if mirror client
    socket.on("caregiver:join", (linkToken: string) => {
      socket.join(`caregiver:${linkToken}`);
      socket.emit("caregiver:joined", { status: "active", token: linkToken });
    });

    // Real-Time Frame Ingestion -> Vision Inference -> Triage -> Audio Narration Out
    socket.on("frame:send", async (data: { image: string; lat?: number; lng?: number }) => {
      try {
        if (!data || !data.image) {
          socket.emit("error", { message: "No image payload received" });
          return;
        }

        const provider = getVisionProvider();
        const triageInput = await provider.analyzeFrame(data.image, {
          lat: data.lat,
          lng: data.lng,
        });

        const output = TriageEngine.triage(
          triageInput,
          data.lat && data.lng ? { lat: data.lat, lng: data.lng } : undefined
        );

        // Store log entry for caregiver mirror review
        const logEntry = appStore.addNarrationLog({
          tier: output.tier,
          text: output.text,
          hapticPattern: output.hapticPattern,
          lat: data.lat,
          lng: data.lng,
        });

        // Send prioritized narration payload back to user device
        socket.emit("narration:receive", output);

        // Broadcast live transcript to any active caregiver mirror sessions
        io.emit("caregiver:live_transcript", {
          entry: logEntry,
          output,
        });
      } catch (err: any) {
        console.error("[Beacon Socket] Frame processing error:", err);
        socket.emit("narration:error", {
          message: err.message || "Failed to process vision frame",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Beacon Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Vite middleware for development & SPA fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Beacon Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
