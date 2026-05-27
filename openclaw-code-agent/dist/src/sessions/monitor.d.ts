import { PluginConfig } from "../types";
import { SessionStore } from "./store";
import { SessionLifecycle } from "./lifecycle";
export declare class Monitor {
    private store;
    private lifecycle;
    private config;
    private intervalMs;
    private intervalId;
    constructor(store: SessionStore, lifecycle: SessionLifecycle, config: PluginConfig);
    /** Start the periodic monitor loop. */
    start(): void;
    /** Stop the periodic monitor loop. */
    stop(): void;
    private tick;
    private checkTimeout;
    private checkZombie;
    private checkAutoCleanup;
}
//# sourceMappingURL=monitor.d.ts.map