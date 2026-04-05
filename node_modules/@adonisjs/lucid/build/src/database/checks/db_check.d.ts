import { BaseCheck } from '@adonisjs/core/health';
import type { HealthCheckResult } from '@adonisjs/core/types/health';
import type { QueryClientContract } from '../../types/database.js';
/**
 * The DbCheck attempts to establish the database connection by
 * executing a sample query.
 */
export declare class DbCheck extends BaseCheck {
    #private;
    /**
     * Health check public name
     */
    name: string;
    constructor(client: QueryClientContract);
    /**
     * Executes the health check
     */
    run(): Promise<HealthCheckResult>;
}
