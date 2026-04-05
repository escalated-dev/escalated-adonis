import { LucidModel, LucidRow } from '../../types/model.js';
import { BelongsToRelationContract } from '../../types/relations.js';
import { RelationCallback, FactoryModelContract, FactoryRelationContract, FactoryBuilderQueryContract } from '../../types/factory.js';
import { BaseRelation } from './base.js';
/**
 * A belongs to factory relation
 */
export declare class BelongsTo extends BaseRelation implements FactoryRelationContract {
    relation: BelongsToRelationContract<LucidModel, LucidModel>;
    constructor(relation: BelongsToRelationContract<LucidModel, LucidModel>, factory: () => FactoryBuilderQueryContract<LucidModel, FactoryModelContract<LucidModel>>);
    /**
     * Make relationship and set it on the parent model instance
     */
    make(parent: LucidRow, callback?: RelationCallback): Promise<void>;
    /**
     * Persist relationship and set it on the parent model instance
     */
    create(parent: LucidRow, callback?: RelationCallback): Promise<void>;
}
