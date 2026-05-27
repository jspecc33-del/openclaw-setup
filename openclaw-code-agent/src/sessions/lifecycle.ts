// ============================================================
// OpenClaw Code Agent — Session Lifecycle
// ============================================================
// Manages session launch, suspend, resume, kill, fork, and
// respond operations. Bridges the store, worktree isolation,
// and harness adapters.

import * as fs from "fs";
import * as path from "path";
import { Session, LaunchParams, PluginConfig, HarnessType } from "../types";
import { HarnessAdapter } from "../harness/base";
import { WorktreeIsolation } from "../worktree/isolation";
import { SessionStore } from "./store";
import { OutputBuffer } from "./output-buffer";

export type HarnessAdapterFactory = (
  session: Session,
  config: PluginConfig,
) => HarnessAdapter;

export class SessionLifecycle {
  private store: SessionStore;
  private config: PluginConfig;
  private worktree: WorktreeIsolation;
  private harnessFactory: HarnessAdapterFactory;
  private activeHarnesses: Map<string, HarnessAdapter>;
  private outputBuffers: Map<string, OutputBuffer>;

  constructor(
    store: SessionStore,
    config: PluginConfig,
    worktree: WorktreeIsolation,
    harnessFactory: HarnessAdapterFactory,
  ) {
    this.store = store;
    this.config = config;
    this.worktree = worktree;
    this.harnessFactory = harnessFactory;
    this.activeHarnesses = new Map();
    this.outputBuffers = new Map();
  }

  // --- Launch ------------------------------------------------

  async launch(params: LaunchParams): Promise<Session> {
    const harness = params.harness ?? this.config.defaultHarness;
    const workdir = params.workdir ?? this.config.defaultWorkdir;

    // 1. Validate workdir exists
    if (!fs.existsSync(workdir)) {
      throw new Error(`Work directory does not exist: ${workdir}`);
    }

    const resolvedWorkdir = path.resolve(workdir);
    let worktreePath: string | undefined;
    let worktreeBranch: string | undefined;
    let baseBranch: string | undefined;

    // 2. Worktree isolation (if strategy is not "off" and dir is a git repo)
    const wtStrategy = params.worktreeStrategy ?? this.config.defaultWorktreeStrategy;
    if (wtStrategy !== "off" && this.worktree.isGitRepo(resolvedWorkdir)) {
      const wt = await this.worktree.create(resolvedWorkdir, params.name);
      worktreePath = wt.worktreePath;
      worktreeBranch = wt.branch;
      baseBranch = wt.baseBranch;
    }

    // 3. Create session record in store
    const session = this.store.create({
      name: params.name,
      harness,
      state: "pending",
      workdir: worktreePath ?? resolvedWorkdir,
      worktreeBranch,
      baseBranch,
      worktreePath,
      originRoute: params.originRoute,
      originThreadId: params.originThreadId,
      metadata: {
        instructions: params.instructions,
        worktreeStrategy: wtStrategy,
      },
    });

    // 4. Spawn harness adapter
    const adapter = this.harnessFactory(session, this.config);
    this.activeHarnesses.set(session.id, adapter);

    // 7. Begin output buffering (before start to capture all output)
    const buffer = new OutputBuffer(this.config.sessionOutputBufferSize);
    this.outputBuffers.set(session.id, buffer);

    adapter.onOutput((chunk: string) => {
      buffer.write(chunk);
      this.store.appendOutput(session.id, chunk);
    });

    adapter.onExit((code: number | null, _signal: string | null) => {
      this.handleHarnessExit(session.id, code);
    });

    await adapter.start(params.instructions);

    // 5 & 6. Set state based on permission mode
    if (this.config.permissionMode === "plan") {
      this.store.update(session.id, { state: "awaiting_plan_approval" });
    } else {
      this.store.update(session.id, { state: "active" });
    }

    return this.store.get(session.id)!;
  }

  // --- Suspend -----------------------------------------------

  async suspend(sessionId: string): Promise<void> {
    const adapter = this.activeHarnesses.get(sessionId);
    if (adapter) {
      await adapter.stop("SIGSTOP");
    }
    this.store.update(sessionId, { state: "suspended" });
  }

  // --- Resume ------------------------------------------------

  async resume(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.state !== "suspended" && session.state !== "pending") {
      throw new Error(`Cannot resume session in state: ${session.state}`);
    }

    const adapter = this.harnessFactory(session, this.config);
    this.activeHarnesses.set(sessionId, adapter);

    const buffer = this.outputBuffers.get(sessionId);
    if (buffer) {
      adapter.onOutput((chunk: string) => {
        buffer.write(chunk);
        this.store.appendOutput(sessionId, chunk);
      });
    }

    adapter.onExit((code: number | null, _signal: string | null) => {
      this.handleHarnessExit(sessionId, code);
    });

    await adapter.resume();
    this.store.update(sessionId, { state: "active" });
  }

  // --- Kill --------------------------------------------------

  async kill(sessionId: string, reason?: string): Promise<void> {
    const adapter = this.activeHarnesses.get(sessionId);
    if (adapter) {
      try {
        await adapter.stop("SIGTERM");
      } catch {
        // Best-effort stop
      }
      this.activeHarnesses.delete(sessionId);
    }

    const patch: Partial<Session> = { state: "killed" };
    if (reason) {
      patch.metadata = {
        ...(this.store.get(sessionId)?.metadata ?? {}),
        killReason: reason,
      };
    }
    this.store.update(sessionId, patch);
  }

  // --- Respond -----------------------------------------------

  async respond(sessionId: string, message: string): Promise<void> {
    const adapter = this.activeHarnesses.get(sessionId);
    if (!adapter) {
      throw new Error(`No active harness for session: ${sessionId}`);
    }
    await adapter.send(message);
  }

  // --- Fork --------------------------------------------------

  async fork(fromSessionId: string, newName: string): Promise<Session> {
    const source = this.store.get(fromSessionId);
    if (!source) {
      throw new Error(`Source session not found: ${fromSessionId}`);
    }

    return this.launch({
      name: newName,
      harness: source.harness,
      workdir: source.workdir,
      instructions: source.metadata?.instructions,
      worktreeStrategy: (source.metadata?.worktreeStrategy as any) ?? "off",
      originRoute: source.originRoute,
      originThreadId: source.originThreadId,
    });
  }

  // --- Harness exit handler ----------------------------------

  private handleHarnessExit(sessionId: string, code: number | null): void {
    const session = this.store.get(sessionId);
    if (!session) return;

    // Only transition from active/completing states
    if (session.state !== "active" && session.state !== "completing") {
      this.activeHarnesses.delete(sessionId);
      return;
    }

    const isCleanExit = code === 0;
    const newState = isCleanExit ? "completed" : "failed";

    this.store.update(sessionId, {
      state: newState,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(session.createdAt).getTime(),
      metadata: {
        ...session.metadata,
        exitCode: code ?? -1,
      },
    });

    this.activeHarnesses.delete(sessionId);
  }

  // --- Internal access (for monitor) -------------------------

  getHarness(sessionId: string): HarnessAdapter | undefined {
    return this.activeHarnesses.get(sessionId);
  }

  getBuffer(sessionId: string): OutputBuffer | undefined {
    return this.outputBuffers.get(sessionId);
  }

  /** Clean up resources for a session. */
  removeHarness(sessionId: string): void {
    this.activeHarnesses.delete(sessionId);
    this.outputBuffers.delete(sessionId);
  }
}
