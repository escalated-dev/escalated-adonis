import { QueryClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { LucidRow, LucidModel, ModelObject, ModelAssignOptions } from '../../../types/model.js';
import { HasManyClientContract } from '../../../types/relations.js';
import { HasMany } from './index.js';
import { HasManyQueryBuilder } from './query_builder.js';
import { HasManySubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export declare class HasManyQueryClient implements HasManyClientContract<HasMany, LucidModel> {
    relation: HasMany;
    private parent;
    private client;
    constructor(relation: HasMany, parent: LucidRow, client: QueryClientContract);
    /**
     * Generate a related query builder
     */
    static query(client: QueryClientContract, relation: HasMany, row: LucidRow): HasManyQueryBuilder;
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client: QueryClientContract, relation: HasMany, rows: OneOrMany<LucidRow>): HasManyQueryBuilder;
    /**
     * Returns an instance of the sub query
     */
    static subQuery(client: QueryClientContract, relation: HasMany): HasManySubQueryBuilder;
    /**
     * Returns instance of query builder
     */
    query(): any;
    /**
     * Save related model instance
     */
    save(related: LucidRow): Promise<void>;
    /**
     * Save related model instance
     */
    saveMany(related: LucidRow[]): Promise<void>;
    /**
     * Create instance of the related model
     */
    create(values: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Create instance of the related model
     */
    createMany(values: ModelObject[], options?: ModelAssignOptions): Promise<LucidRow[]>;
    /**
     * Get the first matching related instance or create a new one
     */
    firstOrCreate(search: any, savePayload?: any, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Update the existing row or create a new one
     */
    updateOrCreate(search: ModelObject, updatePayload: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Fetch the existing related rows or create new one's
     */
    fetchOrCreateMany(payload: ModelObject[], predicate?: any, options?: ModelAssignOptions): Promise<LucidRow[]>;
    /**
     * Update the existing related rows or create new one's
     */
    updateOrCreateMany(payload: ModelObject[], predicate?: any, options?: ModelAssignOptions): Promise<LucidRow[]>;
}
