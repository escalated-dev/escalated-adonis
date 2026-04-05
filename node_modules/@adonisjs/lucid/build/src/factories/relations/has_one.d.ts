import { LucidModel, LucidRow } from '../../types/model.js';
import { HasOneRelationContract } from '../../types/relations.js';
import { RelationCallback, FactoryModelContract, FactoryRelationContract, FactoryBuilderQueryContract } from '../../types/factory.js';
import { BaseRelation } from './base.js';
/**
 * Has one to factory relation
 */
export declare class HasOne extends BaseRelation implements FactoryRelationContract {
    relation: HasOneRelationContract<LucidModel, LucidModel>;
    constructor(relation: HasOneRelationContract<LucidModel, LucidModel>, factory: () => FactoryBuilderQueryContract<LucidModel, FactoryModelContract<LucidModel>>);
    /**
     * Make relationship and set it on the parent model instance
     */
    make(parent: LucidRow, callback?: RelationCallback): Promise<void>;
    /**
     * Persist relationship and set it on the parent model instance
     */
    create(parent: LucidRow, callback?: RelationCallback): Promise<void>;
}
