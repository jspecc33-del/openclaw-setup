import { Session, SessionState, HarnessType } from "../types";
export declare class SessionStore {
    private dataDir;
    private sessionsFile;
    private outputDir;
    private sessions;
    constructor(dataDir: string);
    create(partial: Omit<Session, "id" | "createdAt" | "updatedAt">): Session;
    get(id: string): Session | undefined;
    update(id: string, patch: Partial<Session>): Session;
    list(filter?: {
        state?: SessionState;
        harness?: HarnessType;
    }): Session[];
    delete(id: string): void;
    appendOutput(sessionId: string, chunk: string): void;
    getOutput(sessionId: string, since?: number): string;
    getOutputLength(sessionId: string): number;
    clearOutput(sessionId: string): void;
    private persist;
}
//# sourceMappingURL=store.d.ts.map