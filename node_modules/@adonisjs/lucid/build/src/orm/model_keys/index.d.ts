import { ModelKeysContract, ModelObject } from '../../types/model.js';
/**
 * Exposes the API to collect, get and resolve model keys
 */
export declare class ModelKeys implements ModelKeysContract {
    private keys;
    constructor(keys?: ModelObject);
    /**
     * Add a new key
     */
    add(key: string, value: string): void;
    /**
     * Get value for a given key
     */
    get(key: string, defaultValue: string): string;
    /**
     * Resolve key, if unable to resolve, the key will be
     * returned as it is.
     */
    resolve(key: string): string;
    /**
     * Return all keys
     */
    all(): ModelObject;
}
