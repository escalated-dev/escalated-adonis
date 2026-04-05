import { LucidModel } from '../../types/model.js';
/**
 * Utility to consistently extract relationship keys from the model
 * and the relation model.
 */
export declare class KeysExtractor<Keys extends {
    [key: string]: {
        key: string;
        model: LucidModel;
    };
}> {
    private model;
    private relationName;
    private keys;
    constructor(model: LucidModel, relationName: string, keys: Keys);
    /**
     * Extract the defined keys from the models
     */
    extract(): {
        [P in keyof Keys]: {
            attributeName: string;
            columnName: string;
        };
    };
}
