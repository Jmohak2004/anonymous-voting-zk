// Copies the proving artifacts into public/zk so the browser can fetch them.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, "../../circuits/build");
const out = path.join(here, "../public/zk");
fs.mkdirSync(out, { recursive: true });
for (const f of ["vote.wasm", "vote_final.zkey"]) {
  const src = path.join(build, f);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}. Run \`npm run build:circuit\` in the repo root first.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(out, f));
}
console.log("Copied proving artifacts to public/zk");
