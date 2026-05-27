import { HarnessAdapter } from "./base";
import type { Session } from "../types";
import type { PluginConfig } from "../types";
/**
 * Harness adapter for Claude Code CLI.
 * Spawns and controls the `claude` process in either interactive
 * or prompt mode, with plan detection from output markers.
 */
export declare class ClaudeCodeHarness extends HarnessAdapter {
    readonly type: "claude-code";
    constructor(session: Session, config: PluginConfig);
    /**
     * Start the Claude Code process.
     * If instructions are provided, runs in one-shot prompt mode.
     * Otherwise, spawns an interactive session with stdin/stdout pipes.
     */
    start(instructions?: string): Promise<void>;
    /** Send a message to the interactive Claude Code session. */
    send(message: string): Promise<void>;
    /** Stop the Claude Code process. */
    stop(signal?: NodeJS.Signals): Promise<void>;
    /**
     * Resume a previously suspended session.
     * Claude Code does not have a true resume mechanism through this adapter,
     * so we re-spawn. Future versions may support `claude --resume <sessionId>`.
     */
    resume(): Promise<void>;
    /** Check if the Claude Code process is running. */
    getStatus(): Promise<{
        running: boolean;
        pid?: number;
        exitCode?: number;
    }>;
    /**
     * Detect a plan artifact within an output chunk.
     * Looks for --- PLAN BEGIN --- ... --- PLAN END --- markers.
     */
    detectPlan(outputChunk: string): string | undefined;
    /** Build the environment variables for the Claude Code process. */
    private buildEnv;
    /** Attach stdout, stderr, and exit listeners to the process. */
    private attachListeners;
}
//# sourceMappingURL=claude-code.d.ts.map