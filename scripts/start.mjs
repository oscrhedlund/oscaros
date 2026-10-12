import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const runtimeVariables = [
  "APP_SELF_HOSTED",
  "AI_OWNER_EMAIL",
  "NOTION_OWNER_EMAIL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "SYSTEM_STATUS_OWNER_EMAIL",
  "BESZEL_URL",
  "BESZEL_EMAIL",
  "BESZEL_PASSWORD",
  "NOTION_API_KEY",
  "NOTION_PARENT_PAGE_ID",
  "UPTIME_KUMA_STATUS_URL",
].filter((name) => process.env[name] !== undefined);

const devVarsPath = path.join(projectRoot, ".dev.vars");
const generatedMarker = "# Generated at container startup; do not edit.";
let generatedDevVars = false;
if (existsSync(devVarsPath)) {
  const existing = readFileSync(devVarsPath, "utf8");
  if (existing.startsWith(`${generatedMarker}\n`)) {
    unlinkSync(devVarsPath);
  } else if (runtimeVariables.length > 0) {
    throw new Error("Refusing to overwrite an existing .dev.vars while runtime environment variables are set.");
  }
}
if (runtimeVariables.length > 0) {
  const contents = runtimeVariables
    .map((name) => `${name}=${JSON.stringify(process.env[name])}`)
    .join("\n");
  writeFileSync(devVarsPath, `${generatedMarker}\n${contents}\n`, { flag: "wx", mode: 0o600 });
  generatedDevVars = true;
}

function cleanup() {
  if (generatedDevVars && existsSync(devVarsPath)) unlinkSync(devVarsPath);
}

const child = spawn(process.execPath, [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "dev",
  "--config",
  "dist/server/wrangler.json",
  "--local",
  "--persist-to",
  ".wrangler/state",
  "--ip",
  host,
  "--port",
  String(port),
  "--inspector-port",
  "0",
  "--show-interactive-dev-session",
  "false",
], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    child.kill(signal);
  });
}

child.on("error", (error) => {
  cleanup();
  console.error("Could not start the Personal OS server.", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  cleanup();
  process.exitCode = signal ? 1 : code ?? 1;
});
