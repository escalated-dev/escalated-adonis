import { OneOrMany } from '../../../types/querybuilder.js';
import { QueryClientContract } from '../../../types/database.js';
import { LucidRow, LucidModel, ModelObject } from '../../../types/model.js';
import { RelationOptions, HasManyRelationContract, HasMany as ModelHasMany } from '../../../types/relations.js';
/**
 * Manages persisting and fetching relationships
 */
export declare class HasMany implements HasManyRelationContract<LucidModel, LucidModel> {
    relationName: string;
    relatedModel: () => LucidModel;
    private options;
    model: LucidModel;
    /**
     * The relationship name
     */
    readonly type = "hasMany";
    /**
     * Whether or not the relationship instance has been
     * booted
     */
    booted: boolean;
    /**
     * The key name for serializing the relationship
     */
    serializeAs: string | null;
    /**
     * Local key is reference to the primary key in the self table
     * @note: Available after boot is invoked
     */
    localKey: string;
    localKeyColumnName: string;
    /**
     * Foreign key is reference to the foreign key in the related table
     * @note: Available after boot is invoked
     */
    foreignKey: string;
    foreignKeyColumnName: string;
    /**
     * Reference to the onQuery hook defined by the user
     */
    onQueryHook: ((query: import("../../../types/relations.js").RelationSubQueryBuilderContract<LucidModel> | import("../../../types/relations.js").HasManyQueryBuilderContract<LucidModel, any>) => void) | undefined;
    meta?: any;
    constructor(relationName: string, relatedModel: () => LucidModel, options: RelationOptions<LucidModel, LucidModel, ModelHasMany<LucidModel>>, model: LucidModel);
    /**
     * Returns a boolean saving related row belongs to the parent
     * row or not.
     */
    private isRelatedRow;
    /**
     * Clone relationship instance
     */
    clone(parent: LucidModel): any;
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
     * Returns an instance of the eager query
     */
    eagerQuery(parent: OneOrMany<LucidRow>, client: QueryClientContract): import("./query_builder.js").HasManyQueryBuilder;
    /**
     * Returns instance of query builder
     */
    subQuery(client: QueryClientContract): import("./sub_query_builder.js").HasManySubQueryBuilder;
    /**
     * Hydrates values object for persistance.
     */
    hydrateForPersistance(parent: LucidRow, values: ModelObject | LucidRow): void;
}
