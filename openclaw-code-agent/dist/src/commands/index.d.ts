import type { ToolContext } from "../types";
import type { Session } from "../types";
/**
 * Find a session by its human-readable name.  Names are unique within the
 * active session set.  Returns undefined if no match.
 */
export declare function findSessionByName(store: any, name: string): Session | undefined;
/**
 * Register all chat command handlers onto the plugin context.
 * Returns a dispatch function that processes incoming chat lines.
 */
export declare function registerCommands(ctx: ToolContext): (line: string) => Promise<string>;
/** Export the command names for discovery / help generation. */
export declare function getCommandNames(): string[];
//# sourceMappingURL=index.d.ts.map