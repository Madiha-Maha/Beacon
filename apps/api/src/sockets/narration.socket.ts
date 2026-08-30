import type { Server, Socket } from "socket.io";
import { createVisionProvider } from "../services/vision.service";
import { triageNarration } from "../services/triage.service";
import { schemas } from "@beacon/shared/schemas";
import type { TriageOutput } from "@beacon/shared/types";
import { PrismaClient } from "@prisma/client";

const vision = createVisionProvider();

interface Session {
  userId: string | null;
  lastNarrationAt: number;
  pending: boolean;
}

const HAZARD_DEBOUNCE_MS = 1500;
const SOCIAL_DEBOUNCE_MS = 3500;
const AMBIENT_DEBOUNCE_MS = 7000;

function debounceDelayForTier(tier: TriageOutput["tier"]): number {
  switch (tier) {
    case "hazard":
      return HAZARD_DEBOUNCE_MS;
    case "social":
      return SOCIAL_DEBOUNCE_MS;
    case "ambient":
      return AMBIENT_DEBOUNCE_MS;
  }
}

export function registerNarrationSocket(io: Server) {
  const sessions = new Map<string, Session>();
  const prisma = new PrismaClient();

  io.on("connection", (socket: Socket) => {
    sessions.set(socket.id, {
      userId: null,
      lastNarrationAt: 0,
      pending: false,
    });

    socket.on("identify", (payload: { token?: string; userId?: string }) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      sess.userId = payload.userId ?? null;
    });

    socket.on(
      "frame:send",
      async (raw: { frame?: string; geolocation?: { lat: number; lng: number } }) => {
        const sess = sessions.get(socket.id);
        if (!sess) return;
        if (sess.pending) return;

        let result;
        try {
          result = schemas.SocketFramePayloadSchema.safeParse(raw);
        } catch {
          return;
        }
        if (!result.success) return;
        const payload = result.data;

        sess.pending = true;
        const startedAt = Date.now();

        try {
          const analysis = await vision.analyzeFrame(payload.frame);
          const triaged = triageNarration({
            detectedObjects: analysis.detectedObjects,
            proximityHints: analysis.proximityHints,
            sceneDescription: analysis.sceneDescription,
          });

          const now = Date.now();
          const delay = debounceDelayForTier(triaged.tier);
          if (now - sess.lastNarrationAt < delay && triaged.tier !== "hazard") {
            sess.pending = false;
            return;
          }
          sess.lastNarrationAt = now;

          socket.emit("narration:receive", triaged);

          if (sess.userId) {
            try {
              await prisma.narrationLog.create({
                data: {
                  userId: sess.userId,
                  tier: triaged.tier,
                  text: triaged.text,
                  lat: payload.geolocation?.lat ?? null,
                  lng: payload.geolocation?.lng ?? null,
                },
              });
            } catch (e) {
              console.warn("[narration.socket] Failed to persist narration log:", e);
            }
          }

          io.to(`caregiver-for:${sess.userId}`).emit(
            "caregiver:transcript",
            {
              at: new Date().toISOString(),
              tier: triaged.tier,
              text: triaged.text,
              geolocation: payload.geolocation ?? null,
              latencyMs: Date.now() - startedAt,
            }
          );
        } catch (err) {
          console.error("[narration.socket] frame analysis failed:", err);
          socket.emit("narration:error", {
            message:
              err instanceof Error ? err.message : "Unknown narration error",
          });
        } finally {
          sess.pending = false;
        }
      }
    );

    socket.on("caregiver:subscribe", (payload: { linkId?: string }) => {
      if (payload?.linkId) {
        socket.join(`caregiver-for:${payload.linkId}`);
      }
    });

    socket.on("disconnect", () => {
      sessions.delete(socket.id);
    });
  });
}
