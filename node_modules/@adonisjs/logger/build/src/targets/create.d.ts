import type { TransportTargetOptions } from '../types.js';
/**
 * Exposes the API to construct targets array conditionally.
 */
export declare class Targets {
    #private;
    /**
     * Add target to the list of targets
     */
    push(value: TransportTargetOptions): this;
    /**
     * Conditionally add target to the list targets. The target will only be added
     *  if the `conditional` is true.
     *
     * ```ts
     * targets.if(process.env.NODE_ENV === 'development', {
     *   target: 'pino-pretty'
     * })
     * ```
     */
    pushIf(conditional: boolean, value: TransportTargetOptions | (() => TransportTargetOptions)): this;
    /**
     * Conditionally add target to the list targets. The target will only be added
     * unless the `conditional` is true.
     *
     * ```ts
     * targets.unless(process.env.NODE_ENV === 'production', {
     *   target: 'pino-pretty'
     * })
     * ```
     */
    pushUnless(conditional: boolean, value: TransportTargetOptions | (() => TransportTargetOptions)): this;
    /**
     * Get targets array
     */
    toArray(): TransportTargetOptions[];
}
