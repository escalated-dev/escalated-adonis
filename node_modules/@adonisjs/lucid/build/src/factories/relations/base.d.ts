import { LucidModel, LucidRow } from '../../types/model.js';
import { RelationCallback, FactoryModelContract, FactoryContextContract, FactoryBuilderQueryContract, FactoryRelationContract } from '../../types/factory.js';
/**
 * Base relation to be extended by other factory relations
 */
export declare abstract class BaseRelation {
    private factory;
    protected ctx?: FactoryContextContract;
    private attributes;
    parent: LucidRow;
    constructor(factory: () => FactoryBuilderQueryContract<LucidModel, FactoryModelContract<LucidModel>>);
    /**
     * Instantiates the relationship factory
     */
    protected compile(relation: FactoryRelationContract, parent: LucidRow, callback?: RelationCallback): import("../../types/factory.js").FactoryBuilderContract<LucidModel, FactoryModelContract<LucidModel>>;
    /**
     * Merge attributes with the relationship and its children
     */
    merge(attributes: any): this;
    /**
     * Use custom ctx. This must always be called by the factory, otherwise
     * `make` and `create` calls will fail.
     */
    useCtx(ctx: FactoryContextContract): this;
}
