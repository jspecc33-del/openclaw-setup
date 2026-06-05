/**
 * Abstract base class for all harness adapters.
 * Defines the contract for spawning, controlling, and monitoring
 * external coding agent processes (Claude Code, Codex, etc.).
 */
export class HarnessAdapter {
    session;
    config;
    process;
    outputHandler;
    exitHandler;
    constructor(session, config) {
        this.session = session;
        this.config = config;
    }
    /** Register a handler for output chunks from the process. */
    onOutput(handler) {
        this.outputHandler = handler;
    }
    /** Register a handler for process exit events. */
    onExit(handler) {
        this.exitHandler = handler;
    }
    /** Emit an output chunk to the registered handler. */
    emitOutput(chunk) {
        if (this.outputHandler) {
            this.outputHandler(chunk);
        }
    }
    /** Emit an exit event to the registered handler. */
    emitExit(code, signal) {
        if (this.exitHandler) {
            this.exitHandler(code, signal);
        }
    }
}
//# sourceMappingURL=base.js.map