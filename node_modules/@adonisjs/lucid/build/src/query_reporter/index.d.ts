import { QueryClientContract, TransactionClientContract } from '../types/database.js';
/**
 * Used for reporting queries using the profiler and the event
 * emitter
 */
export declare class QueryReporter {
    private client;
    private debug;
    private data;
    private eventName;
    private startTime;
    private isReady;
    constructor(client: QueryClientContract | TransactionClientContract, debug: boolean, data: any);
    /**
     * Initiate the hrtime when there are one or more query listeners
     */
    private initStartTime;
    /**
     * Emit the query with duration
     */
    private emitQueryEvent;
    /**
     * Begin query reporting. Data passed to this method will
     * overwrite the existing data object
     */
    begin(data?: any): this;
    /**
     * End query reporting
     */
    end(error?: Error): void;
}
