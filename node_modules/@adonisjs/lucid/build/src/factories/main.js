/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { FactoryModel } from './factory_model.js';
/**
 * Factory manager exposes the API to register factories.
 */
export class FactoryManager {
    stubCounter = 1;
    stubIdCallback = (counter) => counter;
    /**
     * Returns the next id
     */
    getNextId(model) {
        return this.stubIdCallback(this.stubCounter++, model);
    }
    /**
     * Define a factory model
     */
    define(model, callback) {
        return new FactoryModel(model, callback, this);
    }
    /**
     * Define custom callback to generate stub ids
     */
    stubId(callback) {
        this.stubIdCallback = callback;
    }
}
const factory = new FactoryManager();
export default factory;
