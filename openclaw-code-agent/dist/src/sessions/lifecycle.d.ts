import { Session, LaunchParams, PluginConfig } from "../types";
import { HarnessAdapter } from "../harness/base";
import { WorktreeIsolation } from "../worktree/isolation";
import { SessionStore } from "./store";
import { OutputBuffer } from "./output-buffer";
export type HarnessAdapterFactory = (session: Session, config: PluginConfig) => HarnessAdapter;
export declare class SessionLifecycle {
    private store;
    private config;
    private worktree;
    private harnessFactory;
    private activeHarnesses;
    private outputBuffers;
    constructor(store: SessionStore, config: PluginConfig, worktree: WorktreeIsolation, harnessFactory: HarnessAdapterFactory);
    launch(params: LaunchParams): Promise<Session>;
    suspend(sessionId: string): Promise<void>;
    resume(sessionId: string): Promise<void>;
    kill(sessionId: string, reason?: string): Promise<void>;
    respond(sessionId: string, message: string): Promise<void>;
    fork(fromSessionId: string, newName: string): Promise<Session>;
    private handleHarnessExit;
    getHarness(sessionId: string): HarnessAdapter | undefined;
    getBuffer(sessionId: string): OutputBuffer | undefined;
    /** Clean up resources for a session. */
    removeHarness(sessionId: string): void;
}
//# sourceMappingURL=lifecycle.d.ts.map