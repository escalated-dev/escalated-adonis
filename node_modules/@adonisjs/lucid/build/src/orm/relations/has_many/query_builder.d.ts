import { Knex } from 'knex';
import { QueryClientContract } from '../../../types/database.js';
import { LucidRow, LucidModel } from '../../../types/model.js';
import { HasManyQueryBuilderContract } from '../../../types/relations.js';
import { HasMany } from './index.js';
import { BaseQueryBuilder } from '../base/query_builder.js';
/**
 * Extends the model query builder for executing queries in scope
 * to the current relationship
 */
export declare class HasManyQueryBuilder extends BaseQueryBuilder implements HasManyQueryBuilderContract<LucidModel, LucidModel> {
    private parent;
    private relation;
    protected appliedConstraints: boolean;
    constructor(builder: Knex.QueryBuilder, client: QueryClientContract, parent: LucidRow | LucidRow[], relation: HasMany);
    /**
     * Profiler data for HasMany relationship
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
    clone(): HasManyQueryBuilder;
    /**
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    protected applyConstraints(): void;
    /**
     * Same as standard model query builder paginate method. But ensures that
     * it is not invoked during eagerloading
     */
    paginate(page: number, perPage?: number): Promise<any>;
    /**
     * Returns the group limit query
     */
    getGroupLimitQuery(): import("../../../types/model.js").ModelQueryBuilderContract<LucidModel, LucidRow>;
}
