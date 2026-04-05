/**
 * NodeEnvManager is used to extract a normalized node environment by
 * inspect the "process.env.NODE_ENV".
 *
 * - The "test" and "testing" envs are normalized to "test"
 * - The "prod" and "production" envs are normalized to "production"
 * - The "dev", "develop", and "development" envs are normalized to "development"
 */
export declare class NodeEnvManager {
    #private;
    nodeEnvironment: 'unknown' | 'development' | 'production' | 'test' | string;
    /**
     * Capture the current node env
     */
    process(): void;
}
