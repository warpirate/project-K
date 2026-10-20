// Runs a command with SUPABASE_DB_PASSWORD loaded from .env.test (git-ignored), so the password never sits in package.json.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = { ...process.env };
for (const line of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
const [cmd, ...args] = process.argv.slice(2);
const res = spawnSync(cmd, args, { stdio: "inherit", env, shell: true });
process.exit(res.status ?? 1);
