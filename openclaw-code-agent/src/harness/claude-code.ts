import { spawn, type ChildProcess } from "node:child_process";
import { HarnessAdapter } from "./base";
import type { Session } from "../types";
import type { PluginConfig } from "../types";

/**
 * Harness adapter for Claude Code CLI.
 * Spawns and controls the `claude` process in either interactive
 * or prompt mode, with plan detection from output markers.
 */
export class ClaudeCodeHarness extends HarnessAdapter {
  readonly type = "claude-code" as const;

  constructor(session: Session, config: PluginConfig) {
    super(session, config);
  }

  /**
   * Start the Claude Code process.
   * If instructions are provided, runs in one-shot prompt mode.
   * Otherwise, spawns an interactive session with stdin/stdout pipes.
   */
  async start(instructions?: string): Promise<void> {
    const executable = this.config.harnesses.claudeCode.executablePath || "claude";
    const workdir = this.session.workdir;
    const env = this.buildEnv();

    const allowedTools = this.config.harnesses.claudeCode.allowedTools;

    if (instructions) {
      // One-shot prompt mode
      const args = ["-p", instructions, "--cwd", workdir];
      if (allowedTools && allowedTools.length > 0) {
        args.push("--allowedTools", allowedTools.join(","));
      }

      this.process = spawn(executable, args, {
        cwd: workdir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      // Interactive mode with stdin/stdout/stderr pipes
      const args: string[] = [];
      if (allowedTools && allowedTools.length > 0) {
        args.push("--allowedTools", allowedTools.join(","));
      }

      this.process = spawn(executable, args, {
        cwd: workdir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    }

    this.attachListeners();
  }

  /** Send a message to the interactive Claude Code session. */
  async send(message: string): Promise<void> {
    if (!this.process || this.process.killed) {
      throw new Error("Claude Code process is not running");
    }
    if (!this.process.stdin || this.process.stdin.writableEnded) {
      throw new Error("Claude Code stdin is not available");
    }
    this.process.stdin.write(message + "\n");
  }

  /** Stop the Claude Code process. */
  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill(signal);
    }
  }

  /**
   * Resume a previously suspended session.
   * Claude Code does not have a true resume mechanism through this adapter,
   * so we re-spawn. Future versions may support `claude --resume <sessionId>`.
   */
  async resume(): Promise<void> {
    // TODO: Attempt `claude --resume <sessionId>` when supported
    // For now, re-spawn without instructions; caller should re-send context
    await this.start();
  }

  /** Check if the Claude Code process is running. */
  async getStatus(): Promise<{ running: boolean; pid?: number; exitCode?: number }> {
    const running = this.process !== undefined && !this.process.killed;
    return {
      running,
      pid: this.process?.pid,
      exitCode: this.process?.exitCode ?? undefined,
    };
  }

  /**
   * Detect a plan artifact within an output chunk.
   * Looks for --- PLAN BEGIN --- ... --- PLAN END --- markers.
   */
  detectPlan(outputChunk: string): string | undefined {
    const beginMarker = "--- PLAN BEGIN ---";
    const endMarker = "--- PLAN END ---";

    const beginIndex = outputChunk.indexOf(beginMarker);
    if (beginIndex === -1) return undefined;

    const endIndex = outputChunk.indexOf(endMarker, beginIndex + beginMarker.length);
    if (endIndex === -1) return undefined;

    const planStart = beginIndex + beginMarker.length;
    return outputChunk.slice(planStart, endIndex).trim();
  }

  /** Build the environment variables for the Claude Code process. */
  private buildEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      CLAUDE_CODE_DEBUG: "1",
    };
  }

  /** Attach stdout, stderr, and exit listeners to the process. */
  private attachListeners(): void {
    if (!this.process) return;

    this.process.stdout?.on("data", (data: Buffer) => {
      this.emitOutput(data.toString("utf-8"));
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      this.emitOutput(data.toString("utf-8"));
    });

    this.process.on("error", (err: Error) => {
      this.emitOutput(`[harness error] ${err.message}\n`);
    });

    this.process.on("exit", (code: number | null, signal: string | null) => {
      this.emitExit(code, signal);
    });
  }
}
