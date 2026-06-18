import { HarnessAdapter } from "./base";
import type { Session } from "../types";
import type { PluginConfig } from "../types";
/**
 * Harness adapter for Codex.
 * Supports two modes:
 * 1. CLI mode: spawns `codex` process similar to Claude Code
 * 2. App Server mode: HTTP API to local Codex App Server
 */
export declare class CodexHarness extends HarnessAdapter {
    readonly type: "codex";
    private threadId?;
    private pollTimer?;
    private appServerUrl?;
    constructor(session: Session, config: PluginConfig);
    /**
     * Start the Codex harness.
     * If appServerUrl is configured, uses HTTP API mode.
     * Otherwise, spawns the `codex` CLI process.
     */
    start(instructions?: string): Promise<void>;
    /** Send a message to the active Codex session. */
    send(message: string): Promise<void>;
    /** Stop the Codex process or delete the app server thread. */
    stop(signal?: NodeJS.Signals): Promise<void>;
    /** Resume a Codex session. */
    resume(): Promise<void>;
    /** Get the current status of the Codex session. */
    getStatus(): Promise<{
        running: boolean;
        pid?: number;
        exitCode?: number;
    }>;
    private startCli;
    private startAppServer;
    private appServerSend;
    private startPolling;
    private request;
    private buildEnv;
    private attachListeners;
}
//# sourceMappingURL=codex.d.ts.map