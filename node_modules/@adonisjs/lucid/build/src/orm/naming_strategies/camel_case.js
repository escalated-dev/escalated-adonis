/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import string from '@poppinss/utils/string';
/**
 * Camelcase naming strategy for the model to use camelcase keys
 * for the serialized output.
 */
export class CamelCaseNamingStrategy {
    /**
     * The default table name for the given model
     */
    tableName(model) {
        return string.pluralize(string.snakeCase(model.name));
    }
    /**
     * The database column name for a given model attribute
     */
    columnName(_, attributeName) {
        return string.snakeCase(attributeName);
    }
    /**
     * The post serialization name for a given model attribute
     */
    serializedName(_, attributeName) {
        return string.camelCase(attributeName);
    }
    /**
     * The local key for a given model relationship
     */
    relationLocalKey(relation, model, relatedModel) {
        if (relation === 'belongsTo') {
            return relatedModel.primaryKey;
        }
        return model.primaryKey;
    }
    /**
     * The foreign key for a given model relationship
     */
    relationForeignKey(relation, model, relatedModel) {
        if (relation === 'belongsTo') {
            return string.camelCase(`${relatedModel.name}_${relatedModel.primaryKey}`);
        }
        return string.camelCase(`${model.name}_${model.primaryKey}`);
    }
    /**
     * Pivot table name for many to many relationship
     */
    relationPivotTable(_, model, relatedModel) {
        return string.snakeCase([relatedModel.name, model.name].sort().join('_'));
    }
    /**
     * Pivot foreign key for many to many relationship
     */
    relationPivotForeignKey(_, model) {
        return string.snakeCase(`${model.name}_${model.primaryKey}`);
    }
    /**
     * Keys for the pagination meta
     */
    paginationMetaKeys() {
        return {
            total: 'total',
            perPage: 'perPage',
            currentPage: 'currentPage',
            lastPage: 'lastPage',
            firstPage: 'firstPage',
            firstPageUrl: 'firstPageUrl',
            lastPageUrl: 'lastPageUrl',
            nextPageUrl: 'nextPageUrl',
            previousPageUrl: 'previousPageUrl',
        };
    }
}
