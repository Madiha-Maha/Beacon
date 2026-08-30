const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_MANAGER = detectPackageManager();
const COLORS = {
  api: "\x1b[33m",
  web: "\x1b[36m",
  dev: "\x1b[35m",
  reset: "\x1b[0m",
};

function detectPackageManager() {
  const execPath = process.env.npm_execpath || "";
  if (execPath.includes("pnpm")) return "pnpm";
  if (fs.existsSync(path.join(ROOT, "pnpm-lock.yaml"))) return "pnpm";
  return "npm";
}

function log(prefix, color, msg) {
  const lines = String(msg).replace(/\r?\n$/, "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() && prefix !== "api" && prefix !== "web") continue;
    process.stdout.write(`${color}[${prefix}]${COLORS.reset} ${line}\n`);
  }
}

function ensureInstalled() {
  const apiHasDeps = fs.existsSync(
    path.join(ROOT, "node_modules", ".pnpm")
  ) || fs.existsSync(path.join(ROOT, "apps", "api", "node_modules"));
  if (apiHasDeps) return Promise.resolve();

  log(
    "dev",
    COLORS.dev,
    `node_modules missing — running \`${PACKAGE_MANAGER} install\` first…`
  );
  return new Promise((resolve, reject) => {
    const ps = spawn(PACKAGE_MANAGER, ["install"], {
      stdio: "inherit",
      cwd: ROOT,
      shell: process.platform === "win32",
    });
    ps.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`install failed with exit ${code}`));
    });
    ps.on("error", reject);
  });
}

function startFilter(pkg, scriptName, prefix, color) {
  const cwd = path.join(ROOT, "apps", pkg);
  const args = ["run", scriptName];
  // With pnpm we can use --filter from root to reuse workspace resolution.
  let cmd = PACKAGE_MANAGER;
  let finalArgs = args;
  let finalCwd = cwd;

  if (PACKAGE_MANAGER === "pnpm") {
    cmd = "pnpm";
    finalArgs = ["--filter", pkg, scriptName];
    finalCwd = ROOT;
  }

  const ps = spawn(cmd, finalArgs, {
    cwd: finalCwd,
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: process.platform === "win32",
  });
  ps.stdout.on("data", (d) => log(prefix, color, d));
  ps.stderr.on("data", (d) => log(prefix, color, d));
  ps.on("exit", (code) => {
    log(prefix, color, `process exited with code ${code}`);
  });
  return ps;
}

async function main() {
  log(
    "dev",
    COLORS.dev,
    `Beacon dev runner (via ${PACKAGE_MANAGER}). Starting API + Web…`
  );
  await ensureInstalled();

  // Guarantee API has a .env so dotenv/config doesn't fail (values are fallbacks anyway).
  const envPath = path.join(ROOT, "apps", "api", ".env");
  if (!fs.existsSync(envPath)) {
    const ex = fs.readFileSync(
      path.join(ROOT, "apps", "api", ".env.example"),
      "utf8"
    );
    fs.writeFileSync(envPath, ex);
    log("dev", COLORS.dev, "Wrote default apps/api/.env from .env.example.");
  }
  const webEnv = path.join(ROOT, "apps", "web", ".env.local");
  if (!fs.existsSync(webEnv)) {
    const ex = fs.readFileSync(
      path.join(ROOT, "apps", "web", ".env.example"),
      "utf8"
    );
    fs.writeFileSync(webEnv, ex);
    log("dev", COLORS.dev, "Wrote default apps/web/.env.local from .env.example.");
  }

  // Prisma generate MUST run before API boots, otherwise @prisma/client throws.
  const prismaClientDir = path.join(
    ROOT,
    "node_modules",
    ".pnpm"
  );
  const generated =
    fs.existsSync(
      path.join(ROOT, "node_modules", "@prisma", "client", "index.js")
    ) || fs.existsSync(path.join(prismaClientDir, "@prisma+client"));
  if (!generated) {
    log("dev", COLORS.dev, "Generating Prisma client (first run)…");
    try {
      const { execSync } = require("child_process");
      const cmd =
        PACKAGE_MANAGER === "pnpm"
          ? "pnpm --filter api exec prisma generate"
          : "cd apps/api && npx prisma generate";
      execSync(cmd, { stdio: "inherit", cwd: ROOT, shell: true });
    } catch (e) {
      log(
        "dev",
        COLORS.dev,
        `Prisma generate failed (this is OK without a DATABASE_URL for now). Continuing…`
      );
    }
  }

  const api = startFilter("api", "dev", "api", COLORS.api);
  const web = startFilter("web", "dev", "web", COLORS.web);

  function shutdown(signal) {
    log("dev", COLORS.dev, `${signal} received — shutting down workers.`);
    for (const ps of [api, web]) {
      try { ps.kill("SIGTERM"); } catch {}
    }
    setTimeout(() => process.exit(0), 800);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => {
    try { api.kill(); } catch {}
    try { web.kill(); } catch {}
  });
}

main().catch((err) => {
  console.error("dev runner failed:", err);
  process.exit(1);
});
