import { LucidModel, LucidRow } from '../types/model.js';
import { DefineCallback, FactoryModelContract, StubIdCallback } from '../types/factory.js';
/**
 * Factory manager exposes the API to register factories.
 */
export declare class FactoryManager {
    private stubCounter;
    private stubIdCallback;
    /**
     * Returns the next id
     */
    getNextId(model: LucidRow): any;
    /**
     * Define a factory model
     */
    define<Model extends LucidModel>(model: Model, callback: DefineCallback<Model>): FactoryModelContract<Model>;
    /**
     * Define custom callback to generate stub ids
     */
    stubId(callback: StubIdCallback): void;
}
declare const factory: FactoryManager;
export default factory;
