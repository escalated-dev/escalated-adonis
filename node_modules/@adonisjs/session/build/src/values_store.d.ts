import type { AllowedSessionValues, SessionData } from './types.js';
/**
 * Readonly session store
 */
export declare class ReadOnlyValuesStore {
    /**
     * Underlying store values
     */
    protected values: SessionData;
    /**
     * Find if store is empty or not
     */
    get isEmpty(): boolean;
    constructor(values: SessionData | null);
    /**
     * Get value for a given key
     */
    get(key: string | string[], defaultValue?: any): any;
    /**
     * A boolean to know if value exists. Extra guards to check
     * arrays for it's length as well.
     */
    has(key: string | string[], checkForArraysLength?: boolean): boolean;
    /**
     * Get all values
     */
    all(): any;
    /**
     * Returns object representation of values
     */
    toObject(): any;
    /**
     * Returns the store values
     */
    toJSON(): any;
    /**
     * Returns string representation of the store
     */
    toString(): string;
}
/**
 * Session store encapsulates the session data and offers a
 * declarative API to mutate it.
 */
export declare class ValuesStore extends ReadOnlyValuesStore {
    #private;
    constructor(values: SessionData | null);
    /**
     * Find if the store has been modified.
     */
    get hasBeenModified(): boolean;
    /**
     * Set key/value pair
     */
    set(key: string | string[], value: AllowedSessionValues): void;
    /**
     * Remove key
     */
    unset(key: string | string[]): void;
    /**
     * Pull value from the store. It is same as calling
     * store.get and then store.unset
     */
    pull(key: string | string[], defaultValue?: any): any;
    /**
     * Increment number. The method raises an error when
     * nderlying value is not a number
     */
    increment(key: string | string[], steps?: number): void;
    /**
     * Increment number. The method raises an error when
     * nderlying value is not a number
     */
    decrement(key: string | string[], steps?: number): void;
    /**
     * Overwrite existing store data with new values.
     */
    update(values: {
        [key: string]: any;
    }): void;
    /**
     * Update to merge values
     */
    merge(values: {
        [key: string]: any;
    }): any;
    /**
     * Reset store by clearing it's values.
     */
    clear(): void;
}
