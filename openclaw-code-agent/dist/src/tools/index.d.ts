import type { ToolContext, GoalTask, Session, AgentStats } from "../types";
export declare const allTools: ({
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            harness: {
                type: string;
                enum: string[];
                description: string;
            };
            workdir: {
                type: string;
                description: string;
            };
            instructions: {
                type: string;
                description: string;
            };
            worktreeStrategy: {
                type: string;
                enum: string[];
                description: string;
            };
            planApproval: {
                type: string;
                enum: string[];
                description: string;
            };
            originRoute: {
                type: string;
                description: string;
            };
            originThreadId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: any, ctx: ToolContext) => Promise<Session>;
} | {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {
            filter: {
                type: string;
                properties: {
                    state: {
                        type: string;
                        description: string;
                    };
                    harness: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                };
                description: string;
            };
        };
    };
    handler: (args: any, ctx: ToolContext) => Promise<Session[]>;
} | {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {};
    };
    handler: (_args: any, ctx: ToolContext) => Promise<AgentStats>;
} | {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
        };
    };
    handler: (args: any, ctx: ToolContext) => Promise<any>;
} | {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            target: {
                type: string;
                description: string;
            };
            verifierCommand: {
                type: string;
                description: string;
            };
            completionSignal: {
                type: string;
                description: string;
            };
            maxIterations: {
                type: string;
                description: string;
            };
            workdir: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: any, ctx: ToolContext) => Promise<GoalTask>;
} | {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: {
            goalId: {
                type: string;
                description: string;
            };
        };
    };
    handler: (args: any, ctx: ToolContext) => Promise<any>;
})[];
/** Convenience map for direct lookup by name. */
export declare const toolsByName: Record<string, (typeof allTools)[number]>;
//# sourceMappingURL=index.d.ts.map