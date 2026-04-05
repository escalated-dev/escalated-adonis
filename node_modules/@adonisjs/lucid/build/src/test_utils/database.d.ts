import { ApplicationService } from '@adonisjs/core/types';
/**
 * Database test utils are meant to be used during testing to
 * perform common tasks like running migrations, seeds, etc.
 */
export declare class DatabaseTestUtils {
    #private;
    protected app: ApplicationService;
    protected connectionName?: string | undefined;
    constructor(app: ApplicationService, connectionName?: string | undefined);
    /**
     * Testing hook for running migrations ( if needed )
     * Return a function to truncate the whole database but keep the schema
     */
    truncate(): Promise<() => Promise<void>>;
    /**
     * Testing hook for running seeds
     */
    seed(): Promise<void>;
    /**
     * Testing hook for running migrations
     * Return a function to rollback the whole database
     *
     * Note that this is slower than truncate() because it
     * has to run all migration in both directions when running tests
     */
    migrate(): Promise<() => Promise<void>>;
    /**
     * Testing hook for creating a global transaction
     */
    withGlobalTransaction(): Promise<() => Promise<void>>;
}
