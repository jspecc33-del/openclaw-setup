// ============================================================
// OpenClaw Code Agent — Output Buffer
// ============================================================
// Line-oriented rolling buffer with timestamp prefix.
// Drops oldest lines when max capacity is exceeded.

export class OutputBuffer {
  private maxLines: number;
  private lines: string[];

  constructor(maxLines: number) {
    this.maxLines = maxLines;
    this.lines = [];
  }

  /**
   * Append a raw chunk (may contain multiple lines).
   * Each non-empty line is prefixed with [YYYY-MM-DD HH:mm:ss].
   */
  write(chunk: string): void {
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

  /**
   * Return lines starting from `since` index (0-based).
   * If omitted, returns all buffered lines.
   */
  getLines(since?: number): string[] {
    if (since === undefined || since <= 0) {
      return [...this.lines];
    }
    return this.lines.slice(since);
  }

  /** Total number of lines currently buffered. */
  getLineCount(): number {
    return this.lines.length;
  }

  /** Clear the buffer. */
  clear(): void {
    this.lines = [];
  }
}
