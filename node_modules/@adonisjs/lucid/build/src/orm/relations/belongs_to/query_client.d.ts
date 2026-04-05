import { OneOrMany } from '../../../types/querybuilder.js';
import { QueryClientContract } from '../../../types/database.js';
import { LucidModel, LucidRow } from '../../../types/model.js';
import { BelongsToClientContract } from '../../../types/relations.js';
import { BelongsTo } from './index.js';
import { BelongsToQueryBuilder } from './query_builder.js';
import { BelongsToSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the belongsTo relationship.
 */
export declare class BelongsToQueryClient implements BelongsToClientContract<BelongsTo, LucidModel> {
    relation: BelongsTo;
    private parent;
    private client;
    constructor(relation: BelongsTo, parent: LucidRow, client: QueryClientContract);
    /**
     * Generate a query builder instance
     */
    static query(client: QueryClientContract, relation: BelongsTo, rows: OneOrMany<LucidRow>): BelongsToQueryBuilder;
    /**
     * Generate a eager query
     */
    static eagerQuery(client: QueryClientContract, relation: BelongsTo, rows: OneOrMany<LucidRow>): BelongsToQueryBuilder;
    /**
     * Returns an instance of the subquery
     */
    static subQuery(client: QueryClientContract, relation: BelongsTo): BelongsToSubQueryBuilder;
    /**
     * Returns instance of query builder
     */
    query(): any;
    /**
     * Associate the related model with the parent model
     */
    associate(related: LucidRow): Promise<void>;
    /**
     * Drop association
     */
    dissociate(): Promise<void>;
}
