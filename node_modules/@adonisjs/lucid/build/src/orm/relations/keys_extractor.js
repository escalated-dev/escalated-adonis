/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import * as errors from '../../errors.js';
/**
 * Utility to consistently extract relationship keys from the model
 * and the relation model.
 */
export class KeysExtractor {
    model;
    relationName;
    keys;
    constructor(model, relationName, keys) {
        this.model = model;
        this.relationName = relationName;
        this.keys = keys;
    }
    /**
     * Extract the defined keys from the models
     */
    extract() {
        const relationRef = `${this.model.name}.${this.relationName}`;
        return Object.keys(this.keys).reduce((result, extractKey) => {
            const { key, model } = this.keys[extractKey];
            const attribute = model.$getColumn(key);
            if (!attribute) {
                throw new errors.E_MISSING_MODEL_ATTRIBUTE([relationRef, key, model.name]);
            }
            result[extractKey] = {
                attributeName: key,
                columnName: attribute.columnName,
            };
            return result;
        }, {});
    }
}
