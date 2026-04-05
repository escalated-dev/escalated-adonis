import { LucidModel, LucidRow, ModelObject } from '../../types/model.js';
import { ManyToManyRelationContract } from '../../types/relations.js';
import { RelationCallback, FactoryModelContract, FactoryRelationContract, FactoryBuilderQueryContract } from '../../types/factory.js';
import { BaseRelation } from './base.js';
/**
 * Many to many factory relation
 */
export declare class ManyToMany extends BaseRelation implements FactoryRelationContract {
    relation: ManyToManyRelationContract<LucidModel, LucidModel>;
    private attributesForPivotTable;
    constructor(relation: ManyToManyRelationContract<LucidModel, LucidModel>, factory: () => FactoryBuilderQueryContract<LucidModel, FactoryModelContract<LucidModel>>);
    /**
     * Make relationship and set it on the parent model instance
     */
    make(parent: LucidRow, callback?: RelationCallback, count?: number): Promise<void>;
    /**
     * Define pivot attributes
     */
    pivotAttributes(attributes: ModelObject | ModelObject[]): this;
    /**
     * Persist relationship and set it on the parent model instance
     */
    create(parent: LucidRow, callback?: RelationCallback, count?: number): Promise<void>;
}
