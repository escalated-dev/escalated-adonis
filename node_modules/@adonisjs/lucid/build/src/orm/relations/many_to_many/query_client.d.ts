import { LucidModel, LucidRow, ModelObject, ModelAssignOptions } from '../../../types/model.js';
import { ManyToManyClientContract } from '../../../types/relations.js';
import { QueryClientContract, TransactionClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { ManyToMany } from './index.js';
import { ManyToManyQueryBuilder } from './query_builder.js';
import { ManyToManySubQueryBuilder } from './sub_query_builder.js';
/**
 * ------------------------------------------------------------
 *                    NO_PIVOT_ATTRS
 * ------------------------------------------------------------
 *
 * We do not define pivot attributes during a save/create calls. Coz, one can
 * attach the related instance with multiple parent instance.
 *
 * For example:
 *
 * user.related('skills').save(skill)
 * user1.related('skills').save(skill)
 *
 * As per the above example, the `skill.$extras.pivot_user_id` will have
 * which user id?
 *
 * Same is true with a create call
 *
 * const skill = user.related('skills').create({ name: 'Programming' })
 * user1.related('skills').save(skill)
 */
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export declare class ManyToManyQueryClient implements ManyToManyClientContract<ManyToMany, LucidModel> {
    relation: ManyToMany;
    private parent;
    private client;
    constructor(relation: ManyToMany, parent: LucidRow, client: QueryClientContract);
    /**
     * Returns the timestamps for the pivot row
     */
    private getPivotTimestamps;
    /**
     * Generate a related query builder
     */
    static query(client: QueryClientContract, relation: ManyToMany, rows: OneOrMany<LucidRow>): ManyToManyQueryBuilder;
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client: QueryClientContract, relation: ManyToMany, rows: OneOrMany<LucidRow>): ManyToManyQueryBuilder;
    /**
     * Returns an instance of the related sub query builder
     */
    static subQuery(client: QueryClientContract, relation: ManyToMany): ManyToManySubQueryBuilder;
    /**
     * Generate a related pivot query builder
     */
    static pivotQuery(client: QueryClientContract, relation: ManyToMany, rows: OneOrMany<LucidRow>): ManyToManyQueryBuilder;
    /**
     * Returns query builder instance
     */
    query(): ManyToManyQueryBuilder;
    /**
     * Returns a query builder instance for the pivot table only
     */
    pivotQuery(): ManyToManyQueryBuilder;
    /**
     * Save related model instance.
     * @note: Read the "NO_PIVOT_ATTRS" section at the top
     */
    save(related: LucidRow, performSync?: boolean, pivotAttributes?: ModelObject): Promise<void>;
    /**
     * Save many of related model instances
     * @note: Read the "NO_PIVOT_ATTRS" section at the top
     */
    saveMany(related: LucidRow[], performSync?: boolean, pivotAttributes?: (ModelObject | undefined)[]): Promise<void>;
    /**
     * Create and persist an instance of related model. Also makes the pivot table
     * entry to create the relationship
     * @note: Read the "NO_PIVOT_ATTRS" section at the top
     */
    create(values: ModelObject, pivotAttributes?: ModelObject, options?: ModelAssignOptions): Promise<LucidRow>;
    /**
     * Create and persist multiple of instances of related model. Also makes
     * the pivot table entries to create the relationship.
     * @note: Read the "NO_PIVOT_ATTRS" section at the top
     */
    createMany(values: ModelObject[], pivotAttributes?: (ModelObject | undefined)[], options?: ModelAssignOptions): Promise<LucidRow[]>;
    /**
     * Attach one or more related models using it's foreign key value
     * by performing insert inside the pivot table.
     */
    attach(ids: (string | number)[] | {
        [key: string]: ModelObject;
    }, trx?: TransactionClientContract): Promise<void>;
    /**
     * Detach related ids from the pivot table
     */
    detach(ids?: (string | number)[], trx?: TransactionClientContract): Promise<void>;
    /**
     * Sync pivot rows by
     *
     * - Dropping the non-existing one's.
     * - Creating the new one's.
     * - Updating the existing one's with different attributes.
     */
    sync(ids: (string | number)[] | {
        [key: string]: ModelObject;
    }, 
    /**
     * Detach means, do not remove existing rows, that are
     * missing in this new object/array.
     */
    detach?: boolean, trx?: TransactionClientContract): Promise<void>;
}
