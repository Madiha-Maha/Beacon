const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'apps', 'api');

function rmDirRecursive(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      rmDirRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }
  fs.rmdirSync(target, { recursive: false });
}

function cleanPrismaArtifacts() {
  const candidates = [
    path.join(ROOT, 'node_modules', '.prisma'),
    path.join(ROOT, 'apps', 'api', 'node_modules', '.prisma'),
    path.join(ROOT, 'node_modules', '@prisma'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      try {
        rmDirRecursive(dir);
      } catch {
        // ignore cleanup failures; we only need the stale temp files removed.
      }
    }
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.prisma') {
          try { rmDirRecursive(full); } catch {}
        } else if (entry.name.startsWith('@prisma')) {
          walk(full);
        } else {
          walk(full);
        }
      } else if (entry.name.includes('.tmp') || entry.name.includes('.tmp.')) {
        try { fs.unlinkSync(full); } catch {}
      }
    }
  }

  const pnpmDir = path.join(ROOT, 'node_modules', '.pnpm');
  walk(pnpmDir);
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

cleanPrismaArtifacts();
runCommand('pnpm', ['exec', 'prisma', 'generate', '--schema=./prisma/schema.prisma'], API_DIR);
