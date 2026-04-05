import { Knex } from 'knex';
import { LucidModel } from '../../../types/model.js';
import { QueryClientContract } from '../../../types/database.js';
import { RelationSubQueryBuilderContract } from '../../../types/relations.js';
import { HasOne } from './index.js';
import { BaseSubQueryBuilder } from '../base/sub_query_builder.js';
export declare class HasOneSubQueryBuilder extends BaseSubQueryBuilder implements RelationSubQueryBuilderContract<LucidModel> {
    private relation;
    protected appliedConstraints: boolean;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, relation: HasOne);
    /**
     * The keys for constructing the join query
     */
    protected getRelationKeys(): string[];
    /**
     * Clones the current query
     */
    clone(): HasOneSubQueryBuilder;
    /**
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    protected applyConstraints(): void;
}
