import { schema as envSchema } from '@poppinss/validator-lite';
import type { ValidateFn } from '@poppinss/validator-lite/types';
import { EnvValidator } from './validator.js';
/**
 * A wrapper over "process.env" with types information.
 *
 * ```ts
 * const validate = Env.rules({
 *   PORT: Env.schema.number()
 * })
 *
 * const validatedEnvVars = validate(process.env)
 *
 * const env = new EnvValues(validatedEnvVars)
 * env.get('PORT') // type === number
 * ```
 */
export declare class Env<EnvValues extends Record<string, any>> {
    #private;
    constructor(values: EnvValues);
    /**
     * Create an instance of the env class by validating the
     * environment variables. Also, the `.env` files are
     * loaded from the appRoot
     */
    static create<Schema extends {
        [key: string]: ValidateFn<unknown>;
    }>(appRoot: URL, schema: Schema): Promise<Env<{
        [K in keyof Schema]: ReturnType<Schema[K]>;
    }>>;
    /**
     * Define an identifier for any environment value. The callback is invoked
     * when the value match the identifier to modify its interpolation.
     *
     * @deprecated use `Env.defineIdentifier` instead
     */
    static identifier(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Define an identifier for any environment value. The callback is invoked
     * when the value match the identifier to modify its interpolation.
     */
    static defineIdentifier(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Define an identifier for any environment value, if it's not already defined.
     * The callback is invoked when the value match the identifier to modify its
     * interpolation.
     */
    static defineIdentifierIfMissing(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Remove an identifier
     */
    static removeIdentifier(name: string): void;
    /**
     * The schema builder for defining validation rules
     */
    static schema: typeof envSchema;
    /**
     * Define the validation rules for validating environment
     * variables. The return value is an instance of the
     * env validator
     */
    static rules<T extends {
        [key: string]: ValidateFn<unknown>;
    }>(schema: T): EnvValidator<T>;
    /**
     * Get the value of an environment variable by key. The values are
     * looked up inside the validated environment and "process.env"
     * is used as a fallback.
     *
     * The second param is the default value, which is returned when
     * the environment variable does not exist.
     *
     * ```ts
     * Env.get('PORT')
     *
     * // With default value
     * Env.get('PORT', 3000)
     * ```
     */
    get<K extends keyof EnvValues>(key: K): EnvValues[K];
    get<K extends keyof EnvValues>(key: K, defaultValue: Exclude<EnvValues[K], undefined>): Exclude<EnvValues[K], undefined>;
    get(key: string): string | undefined;
    get(key: string, defaultValue: string): string;
    /**
     * Update/set value of an environment variable.
     *
     * The value is not casted/validated using the validator, so make sure
     * to set the correct data type.
     *
     * ```ts
     * Env.set('PORT', 3000)
     *
     * Env.get('PORT') === 3000 // true
     * process.env.PORT === '3000' // true
     * ```
     */
    set<K extends keyof EnvValues>(key: K, value: EnvValues[K]): void;
    set(key: string, value: string): void;
}
