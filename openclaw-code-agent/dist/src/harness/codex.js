import { spawn } from "node:child_process";
import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import { HarnessAdapter } from "./base";
/**
 * Harness adapter for Codex.
 * Supports two modes:
 * 1. CLI mode: spawns `codex` process similar to Claude Code
 * 2. App Server mode: HTTP API to local Codex App Server
 */
export class CodexHarness extends HarnessAdapter {
    type = "codex";
    threadId;
    pollTimer;
    appServerUrl;
    constructor(session, config) {
        super(session, config);
        this.appServerUrl = config.harnesses.codex.appServerUrl;
    }
    /**
     * Start the Codex harness.
     * If appServerUrl is configured, uses HTTP API mode.
     * Otherwise, spawns the `codex` CLI process.
     */
    async start(instructions) {
        if (this.appServerUrl) {
            await this.startAppServer(instructions);
        }
        else {
            await this.startCli(instructions);
        }
    }
    /** Send a message to the active Codex session. */
    async send(message) {
        if (this.appServerUrl && this.threadId) {
            await this.appServerSend(message);
        }
        else if (this.process && !this.process.killed) {
            if (!this.process.stdin || this.process.stdin.writableEnded) {
                throw new Error("Codex stdin is not available");
            }
            this.process.stdin.write(message + "\n");
        }
        else {
            throw new Error("Codex session is not running");
        }
    }
    /** Stop the Codex process or delete the app server thread. */
    async stop(signal = "SIGTERM") {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        if (this.appServerUrl && this.threadId) {
            await this.request("DELETE", `/threads/${this.threadId}`).catch(() => {
                // Ignore cleanup errors
            });
            this.threadId = undefined;
        }
        if (this.process && !this.process.killed) {
            this.process.kill(signal);
        }
    }
    /** Resume a Codex session. */
    async resume() {
        if (this.appServerUrl && this.threadId) {
            await this.request("POST", `/threads/${this.threadId}/resume`);
            this.startPolling();
        }
        else {
            // CLI mode: re-spawn
            await this.start();
        }
    }
    /** Get the current status of the Codex session. */
    async getStatus() {
        if (this.appServerUrl && this.threadId) {
            try {
                const response = await this.request("GET", `/threads/${this.threadId}`);
                return { running: response.status === "active", pid: undefined };
            }
            catch {
                return { running: false, pid: undefined };
            }
        }
        const running = this.process !== undefined && !this.process.killed;
        return {
            running,
            pid: this.process?.pid,
            exitCode: this.process?.exitCode ?? undefined,
        };
    }
    // ---------------------------------------------------------------------------
    // CLI Mode
    // ---------------------------------------------------------------------------
    async startCli(instructions) {
        const executable = this.config.harnesses.codex.executablePath || "codex";
        const workdir = this.session.workdir;
        const env = this.buildEnv();
        if (instructions) {
            const args = ["-q", instructions];
            this.process = spawn(executable, args, {
                cwd: workdir,
                env,
                stdio: ["ignore", "pipe", "pipe"],
            });
        }
        else {
            this.process = spawn(executable, [], {
                cwd: workdir,
                env,
                stdio: ["pipe", "pipe", "pipe"],
            });
        }
        this.attachListeners();
    }
    // ---------------------------------------------------------------------------
    // App Server Mode
    // ---------------------------------------------------------------------------
    async startAppServer(instructions) {
        if (!this.appServerUrl) {
            throw new Error("App Server URL is not configured");
        }
        // Create a new thread
        const thread = await this.request("POST", "/threads", {});
        this.threadId = thread.id;
        if (instructions) {
            // Send initial instructions as a turn
            await this.appServerSend(instructions);
        }
        this.startPolling();
    }
    async appServerSend(message) {
        if (!this.threadId) {
            throw new Error("No active thread");
        }
        const body = { message };
        const codexConfig = this.config.harnesses.codex;
        if (codexConfig.reasoningEffort) {
            body.reasoningEffort = codexConfig.reasoningEffort;
        }
        if (codexConfig.fastMode) {
            body.service_tier = "fast";
        }
        await this.request("POST", `/threads/${this.threadId}/turns`, body);
    }
    startPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        this.pollTimer = setInterval(async () => {
            if (!this.threadId)
                return;
            try {
                const response = await this.request("GET", `/threads/${this.threadId}`);
                const status = response.status;
                if (status === "completed" || status === "failed") {
                    this.emitOutput(JSON.stringify(response, null, 2) + "\n");
                    if (this.pollTimer) {
                        clearInterval(this.pollTimer);
                        this.pollTimer = undefined;
                    }
                    this.emitExit(status === "completed" ? 0 : 1, null);
                }
            }
            catch (err) {
                this.emitOutput(`[harness poll error] ${err.message}\n`);
            }
        }, 2000);
    }
    // ---------------------------------------------------------------------------
    // HTTP helper
    // ---------------------------------------------------------------------------
    request(method, path, body) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.appServerUrl);
            const client = url.protocol === "https:" ? https : http;
            const postData = body ? JSON.stringify(body) : undefined;
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
            };
            if (postData) {
                headers["Content-Length"] = Buffer.byteLength(postData).toString();
            }
            const req = client.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method,
                headers,
            }, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(data ? JSON.parse(data) : {});
                        }
                        catch {
                            resolve({ raw: data });
                        }
                    }
                    else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data || "Unknown error"}`));
                    }
                });
            });
            req.on("error", (err) => reject(err));
            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }
    // ---------------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------------
    buildEnv() {
        return {
            ...process.env,
            CODEX_DEBUG: "1",
        };
    }
    attachListeners() {
        if (!this.process)
            return;
        this.process.stdout?.on("data", (data) => {
            this.emitOutput(data.toString("utf-8"));
        });
        this.process.stderr?.on("data", (data) => {
            this.emitOutput(data.toString("utf-8"));
        });
        this.process.on("error", (err) => {
            this.emitOutput(`[harness error] ${err.message}\n`);
        });
        this.process.on("exit", (code, signal) => {
            this.emitExit(code, signal);
        });
    }
}
//# sourceMappingURL=codex.js.map