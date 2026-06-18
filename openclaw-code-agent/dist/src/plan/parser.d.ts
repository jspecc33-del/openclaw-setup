/**
 * Result of parsing output for a plan.
 */
export interface ParseResult {
    /** The extracted plan content, or null if no plan was detected. */
    plan: string | null;
    /** The output remaining after the plan section has been removed. */
    remaining: string;
}
/**
 * Detects and extracts plan artifacts from harness output.
 * Supports multiple marker styles used by different harnesses.
 */
export declare class PlanParser {
    /**
     * Parse harness output and extract any embedded plan.
     *
     * Detection order (first match wins):
     *   1. Claude Code style:  --- PLAN BEGIN --- ... --- PLAN END ---
     *   2. Markdown style:     ## Plan ... ## Implementation
     *   3. Fallback:           numbered list lines (1. ... 2. ...)
     *
     * @param output — raw harness output string
     * @returns parsed plan and remaining output
     */
    parse(output: string): ParseResult;
    /**
     * Extract plan between --- PLAN BEGIN --- and --- PLAN END --- markers.
     */
    private extractClaudeStyle;
    /**
     * Extract plan between ## Plan and ## Implementation markdown headers.
     */
    private extractMarkdownStyle;
    /**
     * Fallback: detect a contiguous block of numbered list lines.
     * Looks for 3+ consecutive lines starting with "N. " where N increments.
     */
    private extractNumberedList;
}
//# sourceMappingURL=parser.d.ts.map