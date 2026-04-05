import { QueryClientContract } from '../../../types/database.js';
import { OneOrMany } from '../../../types/querybuilder.js';
import { LucidRow, LucidModel, ModelObject } from '../../../types/model.js';
import { RelationOptions, BelongsToRelationContract, BelongsTo as ModelBelongsTo } from '../../../types/relations.js';
/**
 * Manages loading and persisting belongs to relationship
 */
export declare class BelongsTo implements BelongsToRelationContract<LucidModel, LucidModel> {
    relationName: string;
    relatedModel: () => LucidModel;
    private options;
    model: LucidModel;
    /**
     * Relationship name
     */
    readonly type = "belongsTo";
    /**
     * Whether or not the relationship instance has been booted
     */
    booted: boolean;
    /**
     * The key name for serializing the relationship
     */
    serializeAs: string | null;
    /**
     * Local key is reference to the primary key in the related table
     * @note: Available after boot is invoked
     */
    localKey: string;
    localKeyColumnName: string;
    /**
     * Foreign key is reference to the foreign key in the self table
     * @note: Available after boot is invoked
     */
    foreignKey: string;
    foreignKeyColumnName: string;
    /**
     * Reference to the onQuery hook defined by the user
     */
    onQueryHook: ((query: import("../../../types/relations.js").RelationQueryBuilderContract<LucidModel, any> | import("../../../types/relations.js").RelationSubQueryBuilderContract<LucidModel>) => void) | undefined;
    meta?: any;
    constructor(relationName: string, relatedModel: () => LucidModel, options: RelationOptions<LucidModel, LucidModel, ModelBelongsTo<LucidModel>>, model: LucidModel);
    /**
     * Clone relationship instance
     */
    clone(parent: LucidModel): any;
    /**
     * Returns a boolean telling if the related row belongs to the parent
     * row or not.
     */
    private isRelatedRow;
    /**
     * Boot the relationship and ensure that all keys are in
     * place for queries to do their job.
     */
    boot(): void;
    /**
     * Set related model instance
     */
    setRelated(parent: LucidRow, related: LucidRow | null): void;
    /**
     * Push related model instance
     */
    pushRelated(parent: LucidRow, related: LucidRow | null): void;
    /**
     * Finds and set the related model instance next to the parent
     * models.
     */
    setRelatedForMany(parent: LucidRow[], related: LucidRow[]): void;
    /**
     * Returns an instance of query client for the given relationship
     */
    client(parent: LucidRow, client: QueryClientContract): any;
    /**
     * Returns instance of the eager query for the relationship
     */
    eagerQuery(parent: OneOrMany<LucidRow>, client: QueryClientContract): any;
    /**
     * Returns instance of query builder
     */
    subQuery(client: QueryClientContract): ReturnType<BelongsToRelationContract<LucidModel, LucidModel>['subQuery']>;
    /**
     * Hydrates values object for persistance.
     */
    hydrateForPersistance(parent: LucidRow, related: ModelObject | LucidRow): void;
}
