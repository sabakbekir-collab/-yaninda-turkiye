import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflowDir = ".github/workflows";
const files = readdirSync(workflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
const deployWorkflow = "cloudflare-deploy.yml";
const forbidden = [
  { label: "--remote", pattern: /--remote\b/ },
  { label: "CLOUDFLARE_API_TOKEN", pattern: /CLOUDFLARE_API_TOKEN/ },
  { label: "CLOUDFLARE_ACCOUNT_ID", pattern: /CLOUDFLARE_ACCOUNT_ID/ },
  { label: "remote D1 target", pattern: /DB_TARGET\s*:\s*remote\b/ },
];

assert.ok(files.includes("ci.yml"), "Expected .github/workflows/ci.yml");
const ci = readFileSync(join(workflowDir, "ci.yml"), "utf8");
assert.match(ci, /--local\b/, "CI must explicitly use local D1");
assert.doesNotMatch(ci, /--remote\b/, "CI must not target remote D1");

for (const file of files) {
  if (file === deployWorkflow) continue;
  const source = readFileSync(join(workflowDir, file), "utf8");
  for (const rule of forbidden) {
    assert.equal(
      rule.pattern.test(source),
      false,
      `${file} must not contain ${rule.label}`,
    );
  }
}

console.log(`PASS CI workflows are local-only (${files.length - (files.includes(deployWorkflow) ? 1 : 0)} checked; dedicated deploy workflow excluded)`);
