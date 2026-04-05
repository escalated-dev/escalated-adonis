import { QueryClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { ModelObject, LucidModel, LucidRow, ModelAssignOptions } from '../../../types/model.js';
import { HasOneClientContract } from '../../../types/relations.js';
import { HasOne } from './index.js';
import { HasOneQueryBuilder } from './query_builder.js';
import { HasOneSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export declare class HasOneQueryClient implements HasOneClientContract<HasOne, LucidModel> {
    relation: HasOne;
    private parent;
    private client;
    constructor(relation: HasOne, parent: LucidRow, client: QueryClientContract);
    /**
     * Generate a related query builder
     */
    static query(client: QueryClientContract, relation: HasOne, rows: OneOrMany<LucidRow>): HasOneQueryBuilder;
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client: QueryClientContract, relation: HasOne, rows: OneOrMany<LucidRow>): HasOneQueryBuilder;
    /**
     * Returns an instance of the sub query builder
     */
    static subQuery(client: QueryClientContract, relation: HasOne): HasOneSubQueryBuilder;
    /**
     * Returns instance of query builder
     */
    query(): any;
    /**
     * Save related model instance
     */
    save(related: LucidRow): Promise<void>;
    /**
     * Create instance of the related model
     */
    create(values: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Get the first matching related instance or create a new one
     */
    firstOrCreate(search: ModelObject, savePayload?: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Update the existing row or create a new one
     */
    updateOrCreate(search: ModelObject, updatePayload: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
}
