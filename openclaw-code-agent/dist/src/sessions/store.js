// ============================================================
// OpenClaw Code Agent — Session Store
// ============================================================
// Persistent JSON store for session metadata + output files.
// All I/O is synchronous for simplicity (local plugin).
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
export class SessionStore {
    dataDir;
    sessionsFile;
    outputDir;
    sessions;
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.sessionsFile = path.join(dataDir, "sessions.json");
        this.outputDir = path.join(dataDir, "output");
        this.sessions = new Map();
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        if (fs.existsSync(this.sessionsFile)) {
            try {
                const raw = fs.readFileSync(this.sessionsFile, "utf-8");
                const parsed = JSON.parse(raw);
                for (const [id, session] of Object.entries(parsed)) {
                    this.sessions.set(id, session);
                }
            }
            catch {
                this.sessions = new Map();
                this.persist();
            }
        }
        else {
            this.persist();
        }
    }
    create(partial) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const session = {
            ...partial,
            id,
            createdAt: now,
            updatedAt: now,
            metadata: partial.metadata ?? {},
        };
        this.sessions.set(id, session);
        this.persist();
        return session;
    }
    get(id) {
        return this.sessions.get(id);
    }
    update(id, patch) {
        const existing = this.sessions.get(id);
        if (!existing) {
            throw new Error(`Session not found: ${id}`);
        }
        const updated = {
            ...existing,
            ...patch,
            id: existing.id,
            updatedAt: new Date().toISOString(),
        };
        this.sessions.set(id, updated);
        this.persist();
        return updated;
    }
    list(filter) {
        let results = Array.from(this.sessions.values());
        if (filter?.state) {
            results = results.filter((s) => s.state === filter.state);
        }
        if (filter?.harness) {
            results = results.filter((s) => s.harness === filter.harness);
        }
        return results;
    }
    delete(id) {
        this.sessions.delete(id);
        this.persist();
    }
    appendOutput(sessionId, chunk) {
        const filePath = path.join(this.outputDir, `${sessionId}.log`);
        const lines = chunk.split("\n");
        const now = new Date();
        const timestamp = now.toISOString().replace("T", " ").slice(0, 19);
        const prefixed = lines
            .map((line) => (line.length > 0 ? `[${timestamp}] ${line}` : line))
            .join("\n");
        fs.appendFileSync(filePath, prefixed + (chunk.endsWith("\n") ? "" : "\n"), "utf-8");
    }
    getOutput(sessionId, since) {
        const filePath = path.join(this.outputDir, `${sessionId}.log`);
        if (!fs.existsSync(filePath)) {
            return "";
        }
        const content = fs.readFileSync(filePath, "utf-8");
        if (since === undefined || since <= 0) {
            return content;
        }
        const allLines = content.split("\n");
        return allLines.slice(since).join("\n");
    }
    getOutputLength(sessionId) {
        const filePath = path.join(this.outputDir, `${sessionId}.log`);
        if (!fs.existsSync(filePath)) {
            return 0;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.length === 0)
            return 0;
        let count = 0;
        for (let i = 0; i < content.length; i++) {
            if (content[i] === "\n")
                count++;
        }
        return count;
    }
    clearOutput(sessionId) {
        const filePath = path.join(this.outputDir, `${sessionId}.log`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // Best-effort cleanup
            }
        }
    }
    persist() {
        const obj = {};
        for (const [id, session] of this.sessions) {
            obj[id] = session;
        }
        fs.writeFileSync(this.sessionsFile, JSON.stringify(obj, null, 2), "utf-8");
    }
}
//# sourceMappingURL=store.js.map