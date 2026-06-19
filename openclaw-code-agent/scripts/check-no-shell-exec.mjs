#!/usr/bin/env node
// Regression guard for the no-shell subprocess invariant documented in
// docs/SECURITY.md: every git/gh subprocess call must use
// execFileSync(file, argsArray, opts), never execSync(string, opts),
// so attacker/agent-controllable strings can never reach a shell.
//
// The one intentional exception is goals/verifier.ts's
// execSync(task.verifierCommand!, ...) — an operator-configured command
// for goal_launch verifier goals, not derived from agent/session input.
//
// This is a single-line regex check, not an AST analysis: it catches
// accidental regressions (the actual threat model) but not a call
// deliberately split across lines or imported under an alias.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(rootDir, "src");

const ALLOWED = new Set(["src/goals/verifier.ts"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const file of walk(srcDir)) {
  const relPath = relative(rootDir, file).replace(/\\/g, "/");
  if (ALLOWED.has(relPath)) continue;

  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    if (/\bexecSync\s*\(/.test(line)) {
      violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Found execSync(string) calls outside the documented exception (docs/SECURITY.md):\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nUse execFileSync(file, argsArray, opts) instead so interpolated values " +
      "(branch names, PR titles/bodies, paths) can never be parsed as shell metacharacters."
  );
  process.exit(1);
}

console.log("OK: no execSync(string) calls outside the documented verifier exception.");
