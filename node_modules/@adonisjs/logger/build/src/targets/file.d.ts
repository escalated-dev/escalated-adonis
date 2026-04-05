import type { FileTargetOptions, TransportTargetOptions, Level } from '../types.js';
/**
 * Construct options object for the file target.
 */
export declare function file(options?: FileTargetOptions, level?: string | Level): TransportTargetOptions;
