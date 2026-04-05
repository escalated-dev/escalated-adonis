import type { Application } from '@adonisjs/core/app';
import type { Codemods } from '@adonisjs/core/ace/codemods';
/**
 * Collection of dialects that can be configured
 */
export declare const DIALECTS: {
    [K in 'sqlite' | 'mysql' | 'libsql' | 'postgres' | 'mssql']: {
        envVars?: Record<string, number | string>;
        envValidations?: Record<string, string>;
        name: string;
        pkg: string[];
    };
};
/**
 * Configures @adonisjs/lucid package by performing following
 * steps.
 *
 * - Creates config/database.ts file.
 * - Registers lucid commands and provider.
 * - Define env variables and their validations (if any)
 * - Creates tmp directory to store sqlite database file
 * - Installs required packages if(options.installPackages === true)
 */
export declare function presetLucid(codemods: Codemods, app: Application<any>, options: {
    dialect: keyof typeof DIALECTS;
    installPackages: boolean;
}): Promise<void>;
