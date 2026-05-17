interface BridgeOptions {
    /** Body written to stdout when the server is unreachable / errors. Default: `"{}"`. */
    fallback?: string;
    /** Abort the HTTP request after this many ms. Default: 54_000. */
    timeoutMs?: number;
    /** Log file path. Default: `/tmp/inkboard-hook-bridge.log`. */
    logFile?: string;
}
export declare function bridgeHook(endpoint: string, opts?: BridgeOptions): Promise<void>;
export {};
//# sourceMappingURL=hook-bridge.d.ts.map