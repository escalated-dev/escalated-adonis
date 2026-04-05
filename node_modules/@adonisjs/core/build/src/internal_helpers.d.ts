import { ApplicationService } from './types.js';
import { RcFile } from '@adonisjs/application/types';
/**
 * Imports assembler optionally
 */
export declare function importAssembler(app: ApplicationService): Promise<typeof import('@adonisjs/assembler') | undefined>;
/**
 * Imports typescript optionally
 */
export declare function importTypeScript(app: ApplicationService): Promise<typeof import('typescript') | undefined>;
/**
 * Detects the assets bundler in use. The rcFile.assetsBundler is
 * used when exists.
 */
export declare function detectAssetsBundler(app: ApplicationService): Promise<RcFile['assetsBundler']>;
