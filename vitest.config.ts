import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

/** Reads KEY=value lines from .env.test (git-ignored). Points tests at the project-k-dev Supabase project. */
function testEnv(): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(".env.test", "utf8");
  } catch {
    throw new Error("Missing .env.test with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  }
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`.env.test is missing ${key}`);
  }
  return env;
}

export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    env: testEnv(),
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
