import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "moats-data-tests-"));
try {
  const entries = [
    ["src/services/moats-data.test.ts", "gateway.test.mjs"],
    ["../moats-pro/src/lib/moats-api.test.ts", "client.test.mjs"],
  ];
  for (const [entry, file] of entries) {
    await build({
      entryPoints: [entry], outfile: join(directory, file),
      bundle: true, platform: "node", format: "esm",
      define: { "import.meta.env": JSON.stringify({ BASE_URL: "/", VITE_API_BASE_URL: "/api" }) },
    });
  }
  const result = spawnSync(process.execPath, ["--test", ...entries.map(([, file]) => join(directory, file))], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
