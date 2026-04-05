import { QueryClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { LucidRow, LucidModel } from '../../../types/model.js';
import { ThroughRelationOptions, HasManyThroughRelationContract, HasManyThrough as ModelHasManyThrough } from '../../../types/relations.js';
/**
 * Manages loading and persisting has many through relationship
 */
export declare class HasManyThrough implements HasManyThroughRelationContract<LucidModel, LucidModel> {
    relationName: string;
    relatedModel: () => LucidModel;
    private options;
    model: LucidModel;
    type: "hasManyThrough";
    booted: boolean;
    serializeAs: string | null;
    throughModel: (() => LucidModel) & (() => LucidModel);
    /**
     * Reference to the onQuery hook defined by the user
     */
    onQueryHook: ((query: import("../../../types/relations.js").RelationSubQueryBuilderContract<LucidModel> | import("../../../types/relations.js").HasManyThroughQueryBuilderContract<LucidModel, any>) => void) | undefined;
    /**
     * Available after boot is invoked
     */
    localKey: string;
    localKeyColumnName: string;
    /**
     * This exists on the through model
     */
    foreignKey: string;
    foreignKeyColumnName: string;
    /**
     * This exists on the through model
     */
    throughLocalKey: string;
    throughLocalKeyColumnName: string;
    /**
     * This exists on the related model
     */
    throughForeignKey: string;
    throughForeignKeyColumnName: string;
    meta?: any;
    constructor(relationName: string, relatedModel: () => LucidModel, options: ThroughRelationOptions<LucidModel, LucidModel, ModelHasManyThrough<LucidModel>> & {
        throughModel: () => LucidModel;
    }, model: LucidModel);
    /**
     * Clone relationship instance
     */
    clone(parent: LucidModel): any;
    /**
     * Returns the alias for the through key
     */
    throughAlias(key: string): string;
    /**
     * Boot the relationship and ensure that all keys are in
     * place for queries to do their job.
     */
    boot(): void;
    /**
     * Set related model instances
     */
    setRelated(parent: LucidRow, related: LucidRow[]): void;
    /**
     * Push related model instance(s)
     */
    pushRelated(parent: LucidRow, related: LucidRow | LucidRow[]): void;
    /**
     * Finds and set the related model instances next to the parent
     * models.
     */
    setRelatedForMany(parent: LucidRow[], related: LucidRow[]): void;
    /**
     * Returns an instance of query client for invoking queries
     */
    client(parent: LucidRow, client: QueryClientContract): any;
    /**
     * Returns instance of the eager query
     */
    eagerQuery(parent: OneOrMany<LucidRow>, client: QueryClientContract): import("./query_builder.js").HasManyThroughQueryBuilder;
    /**
     * Returns instance of query builder
     */
    subQuery(client: QueryClientContract): import("./sub_query_builder.js").HasManyThroughSubQueryBuilder;
}
