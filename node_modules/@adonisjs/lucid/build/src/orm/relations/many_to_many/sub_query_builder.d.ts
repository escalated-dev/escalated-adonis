import { Knex } from 'knex';
import { QueryClientContract } from '../../../types/database.js';
import { LucidModel } from '../../../types/model.js';
import { ManyToManySubQueryBuilderContract } from '../../../types/relations.js';
import { ManyToMany } from './index.js';
import { BaseSubQueryBuilder } from '../base/sub_query_builder.js';
/**
 * Exposes the API to construct sub queries for a many to many relationships
 */
export declare class ManyToManySubQueryBuilder extends BaseSubQueryBuilder implements ManyToManySubQueryBuilderContract<LucidModel> {
    builder: Knex.QueryBuilder;
    client: QueryClientContract;
    relation: ManyToMany;
    /**
     * Pivot helpers provides the implementation for pivot table constraints
     * and clauses
     */
    private pivotHelpers;
    /**
     * Reference to the related table
     */
    private relatedTable;
    private hasSelfRelation;
    /**
     * Whether or not the constraints has been applied
     */
    protected appliedConstraints: boolean;
    isChildQuery: boolean;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, relation: ManyToMany);
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
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    protected applyConstraints(): void;
    /**
     * Select keys from the related table
     */
    select(...args: any[]): this;
    /**
     * Add where clause with pivot table prefix
     */
    wherePivot(key: any, operator?: any, value?: any): this;
    /**
     * Add or where clause with pivot table prefix
     */
    orWherePivot(key: any, operator?: any, value?: any): this;
    /**
     * Alias for wherePivot
     */
    andWherePivot(key: any, operator?: any, value?: any): this;
    /**
     * Add where not pivot
     */
    whereNotPivot(key: any, operator?: any, value?: any): this;
    /**
     * Add or where not pivot
     */
    orWhereNotPivot(key: any, operator?: any, value?: any): this;
    /**
     * Alias for `whereNotPivot`
     */
    andWhereNotPivot(key: any, operator?: any, value?: any): this;
    /**
     * Adds where in clause
     */
    whereInPivot(key: any, value: any): this;
    /**
     * Adds or where in clause
     */
    orWhereInPivot(key: any, value: any): this;
    /**
     * Alias from `whereInPivot`
     */
    andWhereInPivot(key: any, value: any): this;
    /**
     * Adds where not in clause
     */
    whereNotInPivot(key: any, value: any): this;
    /**
     * Adds or where not in clause
     */
    orWhereNotInPivot(key: any, value: any): this;
    /**
     * Alias from `whereNotInPivot`
     */
    andWhereNotInPivot(key: any, value: any): this;
    /**
     * Same as "whereNull", but for the pivot table only
     */
    whereNullPivot(key: string): this;
    /**
     * Same as "orWhereNull", but for the pivot table only
     */
    orWhereNullPivot(key: string): this;
    /**
     * Same as "andWhereNull", but for the pivot table only
     */
    andWhereNullPivot(key: string): this;
    /**
     * Same as "whereNotNull", but for the pivot table only
     */
    whereNotNullPivot(key: string): this;
    /**
     * Same as "orWhereNotNull", but for the pivot table only
     */
    orWhereNotNullPivot(key: string): this;
    /**
     * Same as "andWhereNotNull", but for the pivot table only
     */
    andWhereNotNullPivot(key: string): this;
    /**
     * Select pivot columns
     */
    pivotColumns(columns: string[]): this;
    /**
     * Clones the current query
     */
    clone(): ManyToManySubQueryBuilder;
}
