import type { TransportTargetOptions, Level, PrettyTargetOptions } from '../types.js';
/**
 * Construct options object for the pino-pretty target.
 */
export declare function pretty(options?: PrettyTargetOptions, level?: string | Level): TransportTargetOptions;
