import { access, readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", "outputs"]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".yml",
  ".yaml",
]);

const RULES = [
  { name: "OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: "AWS access key", pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "absolute user profile path",
    pattern: /\b[A-Z]:[\\/]Users[\\/](?!Public(?:[\\/]|$))[^\\/\s]+/gi,
  },
];
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

async function collectFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(absolute, files);
    else files.push(absolute);
  }
  return files;
}

function shouldScan(file) {
  const lower = file.toLowerCase();
  return [...TEXT_EXTENSIONS].some((extension) => lower.endsWith(extension));
}

const issues = [];
try {
  await access(resolve(ROOT, ".env"));
  issues.push(".env: local environment file must not exist in the public candidate repository");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const files = (await collectFiles(ROOT)).filter(shouldScan);
for (const file of files) {
  const text = await readFile(file, "utf8");
  const displayPath = relative(ROOT, file);
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      issues.push(`${displayPath}: ${rule.name} (${match[0].slice(0, 24)}...)`);
    }
  }
  for (const match of text.matchAll(EMAIL)) {
    if (!match[0].toLowerCase().endsWith("@example.com")) {
      issues.push(`${displayPath}: non-example email address`);
    }
  }
}

if (issues.length > 0) {
  console.error(`Privacy scan failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log(`Privacy scan passed: ${files.length} text files checked; outputs directory excluded.`);
}
