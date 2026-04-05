import type { ServerConfig } from './types/server.js';
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
type UserDefinedServerConfig = DeepPartial<Omit<ServerConfig, 'trustProxy'> & {
    trustProxy: ((address: string, distance: number) => boolean) | boolean | string;
}>;
/**
 * Define configuration for the HTTP server
 */
export declare function defineConfig(config: UserDefinedServerConfig): ServerConfig;
export {};
