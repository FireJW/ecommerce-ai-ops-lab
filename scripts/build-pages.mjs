import { mkdir, writeFile } from "node:fs/promises";
import { runDemo } from "../src/pipeline.mjs";

const docsDirectory = new URL("../docs/", import.meta.url);
const dataDirectory = new URL("data/", docsDirectory);
const pack = await runDemo({ writeOutput: false, env: { MODEL_PROVIDER: "demo" } });

delete pack.generated_at;
pack.snapshot_label = "Synthetic fixture snapshot";
pack.public_demo = true;

await mkdir(dataDirectory, { recursive: true });
await writeFile(
  new URL("evidence-pack.json", dataDirectory),
  `${JSON.stringify(pack, null, 2)}\n`,
  "utf8",
);

console.log("Built docs/data/evidence-pack.json");
