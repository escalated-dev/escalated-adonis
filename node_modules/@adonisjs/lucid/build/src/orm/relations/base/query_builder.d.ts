import { Knex } from 'knex';
import { DBQueryCallback } from '../../../types/querybuilder.js';
import { QueryClientContract } from '../../../types/database.js';
import { LucidRow, LucidModel, ModelQueryBuilderContract } from '../../../types/model.js';
import { RelationshipsContract, RelationQueryBuilderContract } from '../../../types/relations.js';
import { ModelQueryBuilder } from '../../query_builder/index.js';
/**
 * Base query builder for ORM Relationships
 */
export declare abstract class BaseQueryBuilder extends ModelQueryBuilder implements RelationQueryBuilderContract<LucidModel, LucidRow> {
    /**
     * Eager constraints
     */
    protected groupConstraints: {
        limit?: number;
        orderBy?: {
            column: string;
            direction?: 'asc' | 'desc';
        };
    };
    /**
     * Is query a relationship query obtained using `related('relation').query()`
     */
    get isRelatedQuery(): true;
    /**
     * Is query a relationship query obtained using `related('relation').subQuery()`
     */
    get isRelatedSubQuery(): false;
    /**
     * Is query a relationship query obtained using one of the preload methods.
     */
    isRelatedPreloadQuery: boolean;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, relation: RelationshipsContract, dbCallback: DBQueryCallback);
    /**
     * Returns the selected columns
     */
    protected getSelectedColumns(): undefined | {
        grouping: 'columns';
        value: any[];
    };
    /**
     * Returns the profiler action. Protected, since the class is extended
     * by relationships
     */
    protected getQueryData(): Knex.Sql & {
        connection: string;
        inTransaction: boolean;
        model: string;
        eagerLoading: boolean;
        relation: any;
    };
    /**
     * Profiler data for the relationship
     */
    protected abstract profilerData(): any;
    /**
     * Returns the sql query keys for the join query
     */
    protected abstract getRelationKeys(): string[];
    /**
     * The relationship query builder must implement this method
     * to apply relationship related constraints
     */
    protected abstract applyConstraints(): void;
    /**
     * Must be implemented by relationships to return query which
     * handles the limit with eagerloading.
     */
    protected abstract getGroupLimitQuery(): never | ModelQueryBuilderContract<LucidModel>;
    /**
     * Returns the name of the query action. Used mainly for
     * raising descriptive errors
     */
    protected queryAction(): string;
    /**
     * Selects the relation keys. Invoked by the preloader
     */
    selectRelationKeys(): this;
    /**
     * Define the group limit
     */
    groupLimit(limit: number): this;
    /**
     * Define the group limit
     */
    groupOrderBy(column: string, direction?: 'asc' | 'desc'): this;
    /**
     * Return knex query
     */
    toKnex(): Knex.QueryBuilder<any, any>;
    /**
     * Get query sql
     */
    toSQL(): Knex.Sql;
    /**
     * Apply constraints before fetching the first
     * row
     */
    first(): Promise<any>;
    /**
     * Execute query
     */
    exec(): Promise<any[]>;
}
