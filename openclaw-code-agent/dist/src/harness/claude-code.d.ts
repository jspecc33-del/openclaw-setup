import { HarnessAdapter } from "./base";
import type { Session } from "../types";
import type { PluginConfig } from "../types";
/**
 * Harness adapter for Claude Code CLI.
 *
 * Spawn model:
 *   - One-shot:    claude -p "<instructions>" --cwd <dir> --allowedTools <tools>
 *   - Interactive: claude --cwd <dir> --allowedTools <tools>  (stdin/stdout pipes)
 *   - Resume:      claude --resume <sessionId> -p "<message>" --cwd <dir>
 *
 * Claude emits its session UUID on stderr.  We capture it so every subsequent
 * call (respond / resume) can pass --resume <id> for true session continuity.
 */
export declare class ClaudeCodeHarness extends HarnessAdapter {
    readonly type: "claude-code";
    private claudeSessionId?;
    private stderrBuffer;
    constructor(session: Session, config: PluginConfig);
    start(instructions?: string): Promise<void>;
    /** Send a follow-up message, reusing the existing Claude session via --resume. */
    send(message: string): Promise<void>;
    stop(signal?: NodeJS.Signals): Promise<void>;
    /** Resume a suspended session using --resume <sessionId> if available. */
    resume(): Promise<void>;
    getStatus(): Promise<{
        running: boolean;
        pid?: number;
        exitCode?: number;
    }>;
    /** The Claude session UUID extracted from stderr (available after first output). */
    getClaudeSessionId(): string | undefined;
    /** Detect a plan artifact within an output chunk (--- PLAN BEGIN/END --- markers). */
    detectPlan(outputChunk: string): string | undefined;
    /**
     * Spawn a new one-shot `claude --resume <sessionId>` process.
     * This is the session-continuity pattern from the Claude Code CLI docs:
     *   claude --resume <uuid> -p "<message>" --cwd <dir>
     */
    private spawnResume;
    /**
     * Extract the Claude session UUID from stderr.
     * Claude prints the UUID on stderr; we keep the last match seen so the
     * stored ID stays current after each resumed turn.
     */
    private extractSessionId;
    private buildEnv;
    /**
     * CLI flags derived from `execPolicy`.
     *
     * - "allow" (default): pass `--dangerously-skip-permissions` so the
     *   unattended background session never blocks on a permission prompt.
     * - "sandbox": omit the flag — Claude Code's normal permission system
     *   applies, auto-denying any tool not covered by `--allowedTools` since
     *   there is no TTY to answer prompts.
     */
    private execPolicyArgs;
    private attachListeners;
}
//# sourceMappingURL=claude-code.d.ts.map