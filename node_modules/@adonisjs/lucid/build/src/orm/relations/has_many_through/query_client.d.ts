import { QueryClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { LucidModel, LucidRow } from '../../../types/model.js';
import { HasManyThroughClientContract } from '../../../types/relations.js';
import { HasManyThrough } from './index.js';
import { HasManyThroughQueryBuilder } from './query_builder.js';
import { HasManyThroughSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export declare class HasManyThroughClient implements HasManyThroughClientContract<HasManyThrough, LucidModel> {
    relation: HasManyThrough;
    private parent;
    private client;
    constructor(relation: HasManyThrough, parent: LucidRow, client: QueryClientContract);
    /**
     * Generate a related query builder
     */
    static query(client: QueryClientContract, relation: HasManyThrough, rows: OneOrMany<LucidRow>): HasManyThroughQueryBuilder;
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client: QueryClientContract, relation: HasManyThrough, rows: OneOrMany<LucidRow>): HasManyThroughQueryBuilder;
    /**
     * Returns an instance of the sub query
     */
    static subQuery(client: QueryClientContract, relation: HasManyThrough): HasManyThroughSubQueryBuilder;
    /**
     * Returns an instance of has many through query builder
     */
    query(): any;
}
