import { Knex } from 'knex';
import { QueryClientContract } from '../../../types/database.js';
import { LucidModel } from '../../../types/model.js';
import { RelationSubQueryBuilderContract } from '../../../types/relations.js';
import { HasManyThrough } from './index.js';
import { BaseSubQueryBuilder } from '../base/sub_query_builder.js';
/**
 * Extends the model query builder for executing queries in scope
 * to the current relationship
 */
export declare class HasManyThroughSubQueryBuilder extends BaseSubQueryBuilder implements RelationSubQueryBuilderContract<LucidModel> {
    private relation;
    /**
     * A boolean to track if query constraints for the relationship
     * has been applied or not
     */
    protected appliedConstraints: boolean;
    /**
     * Reference to the related table
     */
    private relatedTable;
    /**
     * Reference to the through table
     */
    private throughTable;
    private hasSelfRelation;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, relation: HasManyThrough);
    /**
     * Prefixes the through table name to a column
     */
    private prefixThroughTable;
    /**
     * Prefixes the related table name to a column
     */
    private prefixRelatedTable;
    /**
     * Transforms the selected column names by prefixing the
     * table name
     */
    private transformRelatedTableColumns;
    /**
     * The keys for constructing the join query
     */
    protected getRelationKeys(): string[];
    /**
     * Select keys from the related table
     */
    select(...args: any): this;
    /**
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    protected applyConstraints(): void;
    /**
     * Clones the current query
     */
    clone(): HasManyThroughSubQueryBuilder;
}
