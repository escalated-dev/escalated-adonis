import { errors as aceErrors } from '@adonisjs/ace';
import { errors as envErrors } from '@adonisjs/env';
import { errors as appErrors } from '@adonisjs/application';
import { errors as encryptionErrors } from '@adonisjs/encryption';
import { errors as httpServerErrors } from '@adonisjs/http-server';
export { stubsRoot } from './stubs/main.js';
export { inject } from './modules/container.js';
export { Ignitor } from './src/ignitor/main.js';
export { configProvider } from './src/config_provider.js';
/**
 * Aggregated errors from all modules.
 */
export declare const errors: typeof encryptionErrors & typeof httpServerErrors & typeof appErrors & typeof aceErrors & typeof envErrors;
/**
 * Pretty prints an error with colorful output using
 * Youch terminal
 */
export declare function prettyPrintError(error: any): Promise<void>;
