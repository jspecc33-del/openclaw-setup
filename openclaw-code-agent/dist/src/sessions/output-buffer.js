// ============================================================
// OpenClaw Code Agent — Output Buffer
// ============================================================
export class OutputBuffer {
    maxLines;
    lines;
    constructor(maxLines) {
        this.maxLines = maxLines;
        this.lines = [];
    }
    write(chunk) {
        const now = new Date();
        const timestamp = now.toISOString().replace("T", " ").slice(0, 19);
        const incoming = chunk.split("\n");
        for (const raw of incoming) {
            const line = raw.length > 0 ? `[${timestamp}] ${raw}` : raw;
            this.lines.push(line);
            if (this.lines.length > this.maxLines) {
                this.lines.shift();
            }
        }
    }
    getLines(since) {
        if (since === undefined || since <= 0) {
            return [...this.lines];
        }
        return this.lines.slice(since);
    }
    getLineCount() {
        return this.lines.length;
    }
    clear() {
        this.lines = [];
    }
}
//# sourceMappingURL=output-buffer.js.map