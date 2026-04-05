import type { ConfigProvider } from '@adonisjs/core/types';
import type { GuardConfigProvider, GuardFactory } from './types.js';
/**
 * Config resolved by the "defineConfig" method
 */
export type ResolvedAuthConfig<KnownGuards extends Record<string, GuardFactory | GuardConfigProvider<GuardFactory>>> = {
    default: keyof KnownGuards;
    guards: {
        [K in keyof KnownGuards]: KnownGuards[K] extends GuardConfigProvider<infer A> ? A : KnownGuards[K];
    };
};
/**
 * Define configuration for the auth package. The function returns
 * a config provider that is invoked inside the auth service
 * provider
 */
export declare function defineConfig<KnownGuards extends Record<string, GuardFactory | GuardConfigProvider<GuardFactory>>>(config: {
    default: keyof KnownGuards;
    guards: KnownGuards;
}): ConfigProvider<ResolvedAuthConfig<KnownGuards>>;
