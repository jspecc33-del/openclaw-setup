import { spawn } from "node:child_process";
import { HarnessAdapter } from "./base";
const SESSION_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
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
export class ClaudeCodeHarness extends HarnessAdapter {
    type = "claude-code";
    claudeSessionId;
    stderrBuffer = "";
    constructor(session, config) {
        super(session, config);
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    async start(instructions) {
        const executable = this.config.harnesses.claudeCode.executablePath || "claude";
        const workdir = this.session.workdir;
        const allowedTools = this.config.harnesses.claudeCode.allowedTools ?? [];
        const baseArgs = ["--cwd", workdir, ...this.execPolicyArgs()];
        if (allowedTools.length > 0) {
            baseArgs.push("--allowedTools", allowedTools.join(","));
        }
        let args;
        let stdio;
        if (instructions) {
            args = [...baseArgs, "-p", instructions];
            stdio = ["ignore", "pipe", "pipe"];
        }
        else {
            args = [...baseArgs];
            stdio = ["pipe", "pipe", "pipe"];
        }
        this.claudeSessionId = undefined;
        this.stderrBuffer = "";
        this.process = spawn(executable, args, { cwd: workdir, env: this.buildEnv(), stdio });
        this.attachListeners();
    }
    /** Send a follow-up message, reusing the existing Claude session via --resume. */
    async send(message) {
        if (this.claudeSessionId) {
            // Preferred: spawn a new one-shot process that resumes the session.
            await this.spawnResume(message);
        }
        else if (this.process && !this.process.killed) {
            if (!this.process.stdin || this.process.stdin.writableEnded) {
                throw new Error("Claude Code stdin is not available");
            }
            this.process.stdin.write(message + "\n");
        }
        else {
            throw new Error("No active Claude Code process and no session ID for --resume");
        }
    }
    async stop(signal = "SIGTERM") {
        if (this.process && !this.process.killed) {
            this.process.kill(signal);
        }
    }
    /** Resume a suspended session using --resume <sessionId> if available. */
    async resume() {
        if (this.claudeSessionId) {
            await this.spawnResume();
        }
        else {
            // No session ID captured yet — re-spawn fresh interactive session.
            await this.start();
        }
    }
    async getStatus() {
        return {
            running: this.process !== undefined && !this.process.killed,
            pid: this.process?.pid,
            exitCode: this.process?.exitCode ?? undefined,
        };
    }
    /** The Claude session UUID extracted from stderr (available after first output). */
    getClaudeSessionId() {
        return this.claudeSessionId;
    }
    /** Detect a plan artifact within an output chunk (--- PLAN BEGIN/END --- markers). */
    detectPlan(outputChunk) {
        const beginMarker = "--- PLAN BEGIN ---";
        const endMarker = "--- PLAN END ---";
        const beginIndex = outputChunk.indexOf(beginMarker);
        if (beginIndex === -1)
            return undefined;
        const endIndex = outputChunk.indexOf(endMarker, beginIndex + beginMarker.length);
        if (endIndex === -1)
            return undefined;
        return outputChunk.slice(beginIndex + beginMarker.length, endIndex).trim();
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    /**
     * Spawn a new one-shot `claude --resume <sessionId>` process.
     * This is the session-continuity pattern from the Claude Code CLI docs:
     *   claude --resume <uuid> -p "<message>" --cwd <dir>
     */
    async spawnResume(message) {
        if (!this.claudeSessionId)
            throw new Error("No Claude session ID to resume");
        const executable = this.config.harnesses.claudeCode.executablePath || "claude";
        const workdir = this.session.workdir;
        const allowedTools = this.config.harnesses.claudeCode.allowedTools ?? [];
        const args = ["--resume", this.claudeSessionId, "--cwd", workdir, ...this.execPolicyArgs()];
        if (allowedTools.length > 0) {
            args.push("--allowedTools", allowedTools.join(","));
        }
        if (message) {
            args.push("-p", message);
        }
        this.stderrBuffer = "";
        this.process = spawn(executable, args, {
            cwd: workdir,
            env: this.buildEnv(),
            stdio: ["ignore", "pipe", "pipe"],
        });
        this.attachListeners();
    }
    /**
     * Extract the Claude session UUID from stderr.
     * Claude prints the UUID on stderr; we keep the last match seen so the
     * stored ID stays current after each resumed turn.
     */
    extractSessionId(chunk) {
        this.stderrBuffer += chunk;
        const matches = this.stderrBuffer.match(SESSION_ID_RE);
        if (matches && matches.length > 0) {
            this.claudeSessionId = matches[matches.length - 1];
            // Trim buffer to avoid unbounded growth; keep last 2 KB.
            if (this.stderrBuffer.length > 2048) {
                this.stderrBuffer = this.stderrBuffer.slice(-2048);
            }
        }
    }
    buildEnv() {
        return { ...process.env };
    }
    /**
     * CLI flags derived from `execPolicy`.
     *
     * - "allow" (default): pass `--dangerously-skip-permissions` so the
     *   unattended background session never blocks on a permission prompt.
     * - "sandbox": omit the flag — Claude Code's normal permission system
     *   applies, auto-denying any tool not covered by `--allowedTools` since
     *   there is no TTY to answer prompts.
     */
    execPolicyArgs() {
        const execPolicy = this.config.harnesses.claudeCode.execPolicy ?? "allow";
        return execPolicy === "allow" ? ["--dangerously-skip-permissions"] : [];
    }
    attachListeners() {
        if (!this.process)
            return;
        this.process.stdout?.on("data", (data) => {
            this.emitOutput(data.toString("utf-8"));
        });
        this.process.stderr?.on("data", (data) => {
            const text = data.toString("utf-8");
            this.extractSessionId(text);
            // Route stderr to output buffer so callers see it too.
            this.emitOutput(text);
        });
        this.process.on("error", (err) => {
            this.emitOutput(`[harness error] ${err.message}\n`);
        });
        this.process.on("exit", (code, signal) => {
            this.emitExit(code, signal);
        });
    }
}
//# sourceMappingURL=claude-code.js.map