import { ApplicationService, ConfigProvider } from './types.js';
/**
 * Helper to create config provider and resolve config from
 * them
 */
export declare const configProvider: {
    create<T>(resolver: ConfigProvider<T>["resolver"]): ConfigProvider<T>;
    resolve<T>(app: ApplicationService, provider: unknown): Promise<T | null>;
};
