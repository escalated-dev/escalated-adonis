import { ModelRelations } from '../../types/relations.js';
import { NamingStrategyContract, LucidModel } from '../../types/model.js';
/**
 * Uses snake case as the naming strategy for different model properties
 */
export declare class SnakeCaseNamingStrategy implements NamingStrategyContract {
    /**
     * The default table name for the given model
     */
    tableName(model: LucidModel): string;
    /**
     * The database column name for a given model attribute
     */
    columnName(_: LucidModel, attributeName: string): string;
    /**
     * The post serialization name for a given model attribute
     */
    serializedName(_: LucidModel, attributeName: string): string;
    /**
     * The local key for a given model relationship
     */
    relationLocalKey(relation: ModelRelations<LucidModel, LucidModel>['__opaque_type'], model: LucidModel, relatedModel: LucidModel): string;
    /**
     * The foreign key for a given model relationship
     */
    relationForeignKey(relation: ModelRelations<LucidModel, LucidModel>['__opaque_type'], model: LucidModel, relatedModel: LucidModel): string;
    /**
     * Pivot table name for many to many relationship
     */
    relationPivotTable(_: 'manyToMany', model: LucidModel, relatedModel: LucidModel): string;
    /**
     * Pivot foreign key for many to many relationship
     */
    relationPivotForeignKey(_: 'manyToMany', model: LucidModel): string;
    /**
     * Keys for the pagination meta
     */
    paginationMetaKeys(): {
        total: string;
        perPage: string;
        currentPage: string;
        lastPage: string;
        firstPage: string;
        firstPageUrl: string;
        lastPageUrl: string;
        nextPageUrl: string;
        previousPageUrl: string;
    };
}
