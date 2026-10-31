import { readFileSync } from "node:fs";

// Replaced with a literal by the bundler once the build is bundled.
export const VERSION: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;
