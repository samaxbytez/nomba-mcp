import { readFileSync } from "node:fs";

// Inlined by scripts/bundle.mjs; under tsc and vitest it is read from package.json.
declare const PACKAGE_VERSION: string | undefined;

export const VERSION: string =
  typeof PACKAGE_VERSION === "string"
    ? PACKAGE_VERSION
    : JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
