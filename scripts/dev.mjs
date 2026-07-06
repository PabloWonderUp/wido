// Always run the dev server on a FIXED port (default 3002).
// Frees the port first so Next never silently bounces to another one —
// which would split localStorage across origins.
import { execSync, spawn } from "node:child_process";

const PORT = process.env.PORT || "3002";

try {
  const out = execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`, {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
  const pids = out.split("\n").filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGKILL");
      console.log(`freed port ${PORT} (killed pid ${pid})`);
    } catch {
      /* ignore */
    }
  }
} catch {
  // Nothing listening on the port — good.
}

spawn("next", ["dev", "-p", PORT], { stdio: "inherit", shell: true });
