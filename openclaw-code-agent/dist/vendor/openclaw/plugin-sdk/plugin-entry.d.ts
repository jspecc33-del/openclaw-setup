/**
 * Minimal OpenClaw plugin-sdk shim for standalone builds.
 * Provides just enough to satisfy the TypeScript compiler.
 * The real runtime is injected by the OpenClaw host process.
 */
export interface PluginDefinition {
    name: string;
    version: string;
    description?: string;
    contracts?: {
        tools?: string[];
    };
    onLoad?: (ctx: any) => Promise<void>;
    onUnload?: (ctx: any) => Promise<void>;
}
export declare function definePlugin(def: PluginDefinition): PluginDefinition;
//# sourceMappingURL=plugin-entry.d.ts.map