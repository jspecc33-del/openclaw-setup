/**
 * config.ts - Default configuration, user-config merging, and validation.
 *
 * Loads per-user overrides from ~/.openclaw/openclaw.json and merges them
 * with the built-in defaults using a deep-merge strategy.
 */
import type { PluginConfig } from "./types";
/** Path to the user's OpenClaw configuration file. */
export declare const CONFIG_PATH: string;
/** Built-in fallback values. These are used when a key is absent from user config. */
export declare const DEFAULT_CONFIG: PluginConfig;
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
export declare function getConfig(userConfig?: any): PluginConfig;
//# sourceMappingURL=config.d.ts.map