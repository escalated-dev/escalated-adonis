import { Knex } from 'knex';
import { LucidRow } from '../../../types/model.js';
import { QueryClientContract } from '../../../types/database.js';
import { HasOne } from './index.js';
import { BaseQueryBuilder } from '../base/query_builder.js';
/**
 * Extends the model query builder for executing queries in scope
 * to the current relationship
 */
export declare class HasOneQueryBuilder extends BaseQueryBuilder {
    private parent;
    private relation;
    protected appliedConstraints: boolean;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, parent: LucidRow | LucidRow[], relation: HasOne);
    /**
     * Profiler data for HasOne relationship
     */
    protected profilerData(): {
        type: string;
        model: string;
        relatedModel: string;
    };
    /**
     * The keys for constructing the join query
     */
    protected getRelationKeys(): string[];
    /**
     * Clones the current query
     */
    clone(): HasOneQueryBuilder;
    /**
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    protected applyConstraints(): void;
    /**
     * Dis-allow hasOne pagination
     */
    paginate(): Promise<any>;
    /**
     * Dis-allow hasOne group query limit
     */
    getGroupLimitQuery(): never;
}
