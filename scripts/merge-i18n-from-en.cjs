#!/usr/bin/env node
/**
 * Deep-merge each partial locale file with i18n/locales/en-GB.json
 * so every key exists (missing strings fall back to English until translated).
 *
 * Usage: node scripts/merge-i18n-from-en.cjs
 */
const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "..", "i18n", "locales");
const baseName = "en-GB.json";
const targets = ["de-DE.json", "nl-NL.json", "nb-NO.json"];

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function deepMergeBaseWithPartial(base, partial) {
  const out = deepClone(base);
  function walk(dst, src) {
    if (src == null || typeof src !== "object" || Array.isArray(src)) return;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (!(k in dst)) {
        dst[k] = sv;
        continue;
      }
      const dv = dst[k];
      if (
        sv != null &&
        typeof sv === "object" &&
        !Array.isArray(sv) &&
        dv != null &&
        typeof dv === "object" &&
        !Array.isArray(dv)
      ) {
        walk(dv, sv);
      } else {
        dst[k] = sv;
      }
    }
  }
  walk(out, partial);
  return out;
}

const basePath = path.join(localesDir, baseName);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

for (const file of targets) {
  const p = path.join(localesDir, file);
  const partial = JSON.parse(fs.readFileSync(p, "utf8"));
  const merged = deepMergeBaseWithPartial(base, partial);
  fs.writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log("merged", file);
}
