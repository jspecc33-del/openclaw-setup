export declare class OutputBuffer {
    private maxLines;
    private lines;
    constructor(maxLines: number);
    /**
     * Append a raw chunk (may contain multiple lines).
     * Each non-empty line is prefixed with [YYYY-MM-DD HH:mm:ss].
     */
    write(chunk: string): void;
    /**
     * Return lines starting from `since` index (0-based).
     * If omitted, returns all buffered lines.
     */
    getLines(since?: number): string[];
    /** Total number of lines currently buffered. */
    getLineCount(): number;
    /** Clear the buffer. */
    clear(): void;
}
//# sourceMappingURL=output-buffer.d.ts.map