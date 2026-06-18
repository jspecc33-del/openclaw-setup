/**
 * config.ts - Default configuration, user-config merging, and validation.
 *
 * Loads per-user overrides from ~/.openclaw/openclaw.json and merges them
 * with the built-in defaults using a deep-merge strategy.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { PluginConfig } from "./types";

/** Path to the user's OpenClaw configuration file. */
export const CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

/** Built-in fallback values. These are used when a key is absent from user config. */
export const DEFAULT_CONFIG: PluginConfig = {
  defaultWorkdir: process.cwd(),
  defaultHarness: "claude-code",
  permissionMode: "plan",
  planApproval: "delegate",
  defaultWorktreeStrategy: "delegate",
  harnesses: {
    claudeCode: {
      allowedTools: ["Read", "Write", "Edit", "Bash"],
      execPolicy: "allow",
    },
    codex: {
      reasoningEffort: "medium",
      fastMode: false,
    },
  },
  maxSessionDurationMs: 3600000,        // 1 hour
  sessionOutputBufferSize: 50000,       // 50k lines
  autoCleanupCompletedAfterMs: 86400000, // 24 hours
};

/**
 * Deep-merge two plain objects. Arrays are replaced (not concatenated).
 * `source` values win over `target` values at every level.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: any): T {
  if (!source || typeof source !== "object") return target;

  const result = { ...target } as T;

  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];

    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      // Recurse for nested plain objects
      (result as any)[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== undefined) {
      // Primitives, arrays, or explicit nulls replace outright
      (result as any)[key] = srcVal;
    }
  }

  return result;
}

/**
 * Read the user's OpenClaw configuration file and extract the plugin-specific
 * config object at plugins.entries["openclaw-code-agent"].config.
 * Returns undefined when the file is missing or unreadable.
 */
function readUserConfig(): any {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed?.plugins?.entries?.["openclaw-code-agent"]?.config ?? undefined;
  } catch {
    // File missing, unreadable, or malformed — silently fall back to defaults
    return undefined;
  }
}

/**
 * Resolve the final plugin configuration.
 *
 * 1. Starts with built-in DEFAULT_CONFIG.
 * 2. Merges overrides from ~/.openclaw/openclaw.json (if present).
 * 3. Merges any runtime `userConfig` passed explicitly (e.g. from tests).
 *
 * @param userConfig - Optional runtime overrides (highest priority).
 * @returns Fully merged PluginConfig.
 */
export function getConfig(userConfig?: any): PluginConfig {
  const fileConfig = readUserConfig();
  let merged: PluginConfig = DEFAULT_CONFIG;

  if (fileConfig) {
    merged = deepMerge(merged, fileConfig);
  }

  if (userConfig) {
    merged = deepMerge(merged, userConfig);
  }

  // Basic presence validation — warn but do not throw for now
  if (!merged.maxSessionDurationMs || merged.maxSessionDurationMs <= 0) {
    console.warn("[code-agent] Invalid maxSessionDurationMs, falling back to default");
    merged.maxSessionDurationMs = DEFAULT_CONFIG.maxSessionDurationMs;
  }

  if (!merged.sessionOutputBufferSize || merged.sessionOutputBufferSize <= 0) {
    console.warn("[code-agent] Invalid sessionOutputBufferSize, falling back to default");
    merged.sessionOutputBufferSize = DEFAULT_CONFIG.sessionOutputBufferSize;
  }

  if (!merged.autoCleanupCompletedAfterMs || merged.autoCleanupCompletedAfterMs < 0) {
    console.warn("[code-agent] Invalid autoCleanupCompletedAfterMs, falling back to default");
    merged.autoCleanupCompletedAfterMs = DEFAULT_CONFIG.autoCleanupCompletedAfterMs;
  }

  return merged;
}
