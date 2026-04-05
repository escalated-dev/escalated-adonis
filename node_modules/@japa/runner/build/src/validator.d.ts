import { NormalizedConfig } from './types.js';
/**
 * Validator encapsulates the validations to perform before running
 * the tests
 */
declare class Validator {
    /**
     * Ensures the japa is configured. Otherwise raises an exception
     */
    ensureIsConfigured(config: NormalizedConfig | undefined): void;
    /**
     * Ensures the japa is in planning phase
     */
    ensureIsInPlanningPhase(phase: 'idle' | 'planning' | 'executing'): void;
    /**
     * Ensures the suites filter uses a subset of the user configured suites.
     */
    validateSuitesFilter(config: NormalizedConfig): void;
    /**
     * Ensure there are unique suites
     */
    validateSuitesForUniqueness(config: NormalizedConfig): void;
    /**
     * Ensure the activated reporters are in the list of defined
     * reporters
     */
    validateActivatedReporters(config: NormalizedConfig): void;
}
declare const _default: Validator;
export default _default;
