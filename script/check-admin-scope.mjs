import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["client", "server", "shared"];
const blockedPatterns = [
  { label: "TCK Wellness", pattern: /TCK Wellness/i },
  { label: "TCK", pattern: /\bTCK\b/ },
  { label: "Directory", pattern: /\bDirectory\b/ },
  { label: "Applications", pattern: /\bApplications\b/ },
  { label: "Events", pattern: /\bEvents\b/ },
  { label: "Client Portal", pattern: /\bclient portal\b/i },
  { label: "User Agreement Gate", pattern: /\buser agreement\b/i },
  { label: "Agreement Gate", pattern: /\bagreement gate\b/i },
  { label: "Terms Acceptance", pattern: /\baccept terms\b/i },
  { label: "Terms Acceptance", pattern: /\bterms acceptance\b/i },
  { label: "Terms Acceptance", pattern: /\btermsAndConditions\b/ },
  { label: "Agreement Required", pattern: /\brequiresAgreement\b/ },
  { label: "Agreement Required", pattern: /\bagreementRequired\b/ },
];
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.name === "dist" || entry.name === "node_modules" || entry.name.startsWith(".")) {
        return [];
      }
      if (entry.isDirectory()) return walk(entryPath);
      return textExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

const files = (
  await Promise.all(scanRoots.map((scanRoot) => walk(path.join(root, scanRoot)).catch(() => [])))
).flat();

const matches = [];
for (const file of files) {
  const body = await readFile(file, "utf8");
  const lines = body.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const blocked of blockedPatterns) {
      if (blocked.pattern.test(line)) {
        matches.push({
          file: path.relative(root, file),
          line: index + 1,
          label: blocked.label,
          text: line.trim(),
        });
      }
    }
  });
}

if (matches.length > 0) {
  console.error("Out-of-scope source-project module references were found:");
  matches.forEach((match) => {
    console.error(`${match.file}:${match.line} [${match.label}] ${match.text}`);
  });
  process.exit(1);
}

console.log("Admin scope check passed.");
