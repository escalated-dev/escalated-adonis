import { version, transport, multistream, destination, stdSerializers, stdTimeFunctions, type Logger as PinoLogger } from 'pino';
import type { LoggerConfig, LevelMapping } from './types.js';
/**
 * Returns an instance of pino logger by adjusting the config options
 */
export declare function createPino<Config extends LoggerConfig>(options: Config): PinoLogger<string>;
/**
 * Static copy of pino level mappings
 */
export declare const levels: LevelMapping;
export { destination, transport, stdSerializers, multistream, stdTimeFunctions, version };
