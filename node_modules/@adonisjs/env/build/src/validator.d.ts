import type { ValidateFn } from '@poppinss/validator-lite/types';
/**
 * Exposes the API to validate environment variables against a
 * pre-defined schema.
 *
 * The class is not exported in the main API and used internally.
 */
export declare class EnvValidator<Schema extends {
    [key: string]: ValidateFn<unknown>;
}> {
    #private;
    constructor(schema: Schema);
    /**
     * Accepts an object of values to validate against the pre-defined
     * schema.
     *
     * The return value is a merged copy of the original object and the
     * values mutated by the schema validator.
     */
    validate(values: {
        [K: string]: string | undefined;
    }): {
        [K in keyof Schema]: ReturnType<Schema[K]>;
    };
}
