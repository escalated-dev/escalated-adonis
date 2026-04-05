import { LucidModel, LucidRow } from '../../types/model.js';
import { HasManyRelationContract } from '../../types/relations.js';
import { RelationCallback, FactoryModelContract, FactoryRelationContract, FactoryBuilderQueryContract } from '../../types/factory.js';
import { BaseRelation } from './base.js';
/**
 * Has many to factory relation
 */
export declare class HasMany extends BaseRelation implements FactoryRelationContract {
    relation: HasManyRelationContract<LucidModel, LucidModel>;
    constructor(relation: HasManyRelationContract<LucidModel, LucidModel>, factory: () => FactoryBuilderQueryContract<LucidModel, FactoryModelContract<LucidModel>>);
    /**
     * Make relationship and set it on the parent model instance
     */
    make(parent: LucidRow, callback?: RelationCallback, count?: number): Promise<void>;
    /**
     * Persist relationship and set it on the parent model instance
     */
    create(parent: LucidRow, callback?: RelationCallback, count?: number): Promise<void>;
}
