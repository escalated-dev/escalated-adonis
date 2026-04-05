import type { ConfigProvider } from '@adonisjs/core/types';
import type { CookieOptions } from '@adonisjs/core/types/http';
import type { SessionConfig, FileStoreConfig, RedisStoreConfig, SessionStoreFactory, DynamoDBStoreConfig, DatabaseStoreConfig } from './types.js';
/**
 * Resolved config with stores
 */
type ResolvedConfig<KnownStores extends Record<string, SessionStoreFactory>> = SessionConfig & {
    store: keyof KnownStores;
    stores: KnownStores;
    cookie: Partial<CookieOptions>;
};
/**
 * Helper to normalize session config
 */
export declare function defineConfig<KnownStores extends Record<string, SessionStoreFactory | ConfigProvider<SessionStoreFactory>>>(config: Partial<SessionConfig> & {
    store: keyof KnownStores | 'memory';
    stores: KnownStores;
}): ConfigProvider<ResolvedConfig<{
    [K in keyof KnownStores]: SessionStoreFactory;
}>>;
/**
 * Inbuilt stores to store the session data.
 */
export declare const stores: {
    file: (config: FileStoreConfig) => ConfigProvider<SessionStoreFactory>;
    redis: (config: RedisStoreConfig) => ConfigProvider<SessionStoreFactory>;
    cookie: () => ConfigProvider<SessionStoreFactory>;
    dynamodb: (config: DynamoDBStoreConfig) => ConfigProvider<SessionStoreFactory>;
    database: (config?: DatabaseStoreConfig) => ConfigProvider<SessionStoreFactory>;
};
export {};
