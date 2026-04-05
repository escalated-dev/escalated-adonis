import { ConsoleDumpConfig } from '@poppinss/dumper/console/types';
import { HTMLDumpConfig } from '@poppinss/dumper/html/types';
/**
 * Define config for the dumper service exported by
 * the "@adonisjs/core/services/dumper" module
 */
export declare function defineConfig(dumperConfig: Partial<{
    html: HTMLDumpConfig;
    console: ConsoleDumpConfig;
}>): Partial<{
    html: HTMLDumpConfig;
    console: ConsoleDumpConfig;
}>;
