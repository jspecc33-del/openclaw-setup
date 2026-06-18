import type { ChildProcess } from "node:child_process";
import type { Session, HarnessType } from "../types";
import type { PluginConfig } from "../types";
/**
 * Abstract base class for all harness adapters.
 * Defines the contract for spawning, controlling, and monitoring
 * external coding agent processes (Claude Code, Codex, etc.).
 */
export declare abstract class HarnessAdapter {
    abstract readonly type: HarnessType;
    protected session: Session;
    protected config: PluginConfig;
    protected process?: ChildProcess;
    private outputHandler?;
    private exitHandler?;
    constructor(session: Session, config: PluginConfig);
    /** Start the harness process with optional instructions. */
    abstract start(instructions?: string): Promise<void>;
    /** Send a message to the running harness process. */
    abstract send(message: string): Promise<void>;
    /** Stop the harness process with an optional signal. */
    abstract stop(signal?: NodeJS.Signals): Promise<void>;
    /** Resume a previously stopped or suspended session. */
    abstract resume(): Promise<void>;
    /** Get the current status of the harness process. */
    abstract getStatus(): Promise<{
        running: boolean;
        pid?: number;
        exitCode?: number;
    }>;
    /** Register a handler for output chunks from the process. */
    onOutput(handler: (chunk: string) => void): void;
    /** Register a handler for process exit events. */
    onExit(handler: (code: number | null, signal: string | null) => void): void;
    /** Emit an output chunk to the registered handler. */
    protected emitOutput(chunk: string): void;
    /** Emit an exit event to the registered handler. */
    protected emitExit(code: number | null, signal: string | null): void;
}
//# sourceMappingURL=base.d.ts.map