import { config as loadDotenv } from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { Server as SocketIOServer } from "socket.io";
import { errorMiddleware } from "./middleware/error.middleware";
import { authRoutes } from "./routes/auth.routes";
import { hazardsRoutes } from "./routes/hazards.routes";
import { caregiverRoutes } from "./routes/caregiver.routes";
import { registerNarrationSocket } from "./sockets/narration.socket";

loadDotenv();

let prisma: PrismaClient | null = null;

function safeCreatePrisma(): PrismaClient | null {
  try {
    return new PrismaClient({
      errorFormat: "minimal",
      log: [],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      "[beacon-api] @prisma/client unavailable (did you run `prisma generate`?).",
      "Auth/hazards/caregiver routes will be disabled until Prisma is configured.",
      message
    );
    return null;
  }
}

const app = express();
const server = http.createServer(app);

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

{
  const maybe = safeCreatePrisma();
  if (maybe) {
    prisma = maybe;
    app.use("/auth", authRoutes);
    app.use("/hazards", hazardsRoutes);
    app.use("/caregiver", caregiverRoutes);
  } else {
    prisma = null;
    app.use(["/auth", "/hazards", "/caregiver"], (_req, res) => {
      res.status(503).json({
        error:
          "Prisma client is unavailable. Run `pnpm --filter api exec prisma generate` and set DATABASE_URL.",
      });
    });
  }
}

app.use(errorMiddleware);

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024,
});

registerNarrationSocket(io);

const PORT = Number(process.env.PORT ?? 4000);

async function bootstrap() {
  if (prisma) {
    try {
      await prisma.$connect();
      console.log("[beacon-api] Prisma connected");
    } catch (e) {
      console.warn(
        "[beacon-api] Prisma $connect failed (DB down or DATABASE_URL unset?).",
        "Running without persistent DB; narration socket + /health still work.",
        (e as Error).message
      );
      prisma = null;
    }
  }

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[beacon-api] HTTP server listening on port ${PORT}`);
  console.log(`[beacon-api] CORS origins: ${corsOrigins.join(", ")}`);
  console.log(`[beacon-api] Health check available at /health`);
  console.log(
    `[beacon-api] Vision provider: ${process.env.VISION_PROVIDER ?? "mock"}`
  );
}

bootstrap().catch((err) => {
  console.error("[beacon-api] Failed to bootstrap:", err);
  process.exit(1);
});

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error(
      "Prisma client is unavailable. Ensure DATABASE_URL is set and `prisma generate` has run."
    );
  }
  return prisma;
}

export { prisma };

