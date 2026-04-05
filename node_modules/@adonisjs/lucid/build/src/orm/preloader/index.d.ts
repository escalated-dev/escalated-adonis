import { LucidRow, LucidModel, ModelObject } from '../../types/model.js';
import { PreloaderContract } from '../../types/relations.js';
import { QueryClientContract } from '../../types/database.js';
/**
 * Exposes the API to define and preload relationships in reference to
 * a model
 */
export declare class Preloader implements PreloaderContract<LucidRow> {
    private model;
    private preloads;
    /**
     * When invoked via query builder. The preloader will get the side-loaded
     * object, that should be transferred to relationship model instances.
     */
    private sideloaded;
    private debugQueries;
    constructor(model: LucidModel);
    /**
     * Processes a relationship for a single parent
     */
    private processRelation;
    /**
     * Process a given relationship for many parent instances. This happens
     * during eager-loading
     */
    private processRelationForMany;
    /**
     * Define a relationship to preload
     */
    load(name: any, callback?: any): this;
    /**
     * Alias for "this.load"
     */
    preload(name: any, callback?: any): this;
    /**
     * Define a relationship to preload, but only if they are not
     * already preloaded
     */
    preloadOnce(name: any): this;
    /**
     * Toggle query debugging
     */
    debug(debug: boolean): this;
    /**
     * Define attributes to be passed to all the model instance as
     * side-loaded attributes
     */
    sideload(values: ModelObject): this;
    /**
     * Clone preloader instance
     */
    clone(): Preloader;
    /**
     * Process of all the preloaded relationships for a single parent
     */
    processAllForOne(parent: LucidRow, client: QueryClientContract): Promise<void>;
    /**
     * Process of all the preloaded relationships for many parents
     */
    processAllForMany(parent: LucidRow[], client: QueryClientContract): Promise<void>;
}
