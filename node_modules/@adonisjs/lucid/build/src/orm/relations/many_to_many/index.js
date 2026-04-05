/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { KeysExtractor } from '../keys_extractor.js';
import { ManyToManyQueryClient } from './query_client.js';
import { ensureRelationIsBooted, getValue } from '../../../utils/index.js';
/**
 * Manages loading and persisting many to many relationship
 */
export class ManyToMany {
    relationName;
    relatedModel;
    options;
    model;
    type = 'manyToMany';
    booted = false;
    serializeAs;
    /**
     * Timestamp columns for the pivot table
     */
    get pivotTimestamps() {
        const timestamps = [];
        this.pivotCreatedAtTimestamp && timestamps.push(this.pivotCreatedAtTimestamp);
        this.pivotUpdatedAtTimestamp && timestamps.push(this.pivotUpdatedAtTimestamp);
        return timestamps;
    }
    /**
     * Reference to the onQuery hook defined by the user
     */
    onQueryHook;
    /**
     * Computes the created at timestamps column name
     * for the pivot table
     */
    computedCreatedAtTimestamp() {
        if (!this.options.pivotTimestamps) {
            return;
        }
        if (this.options.pivotTimestamps === true) {
            this.pivotCreatedAtTimestamp = 'created_at';
            return;
        }
        if (typeof this.options.pivotTimestamps.createdAt === 'string') {
            this.pivotCreatedAtTimestamp = this.options.pivotTimestamps.createdAt;
        }
        else if (this.options.pivotTimestamps.createdAt === true) {
            this.pivotCreatedAtTimestamp = 'created_at';
        }
    }
    /**
     * Computes the updated at timestamps column name
     * for the pivot table
     */
    computedUpdatedAtTimestamp() {
        if (!this.options.pivotTimestamps) {
            return;
        }
        if (this.options.pivotTimestamps === true) {
            this.pivotUpdatedAtTimestamp = 'updated_at';
            return;
        }
        if (typeof this.options.pivotTimestamps.updatedAt === 'string') {
            this.pivotUpdatedAtTimestamp = this.options.pivotTimestamps.updatedAt;
        }
        else if (this.options.pivotTimestamps.updatedAt === true) {
            this.pivotUpdatedAtTimestamp = 'updated_at';
        }
    }
    constructor(relationName, relatedModel, options, model) {
        this.relationName = relationName;
        this.relatedModel = relatedModel;
        this.options = options;
        this.model = model;
        this.serializeAs =
            this.options.serializeAs === undefined ? this.relationName : this.options.serializeAs;
        this.pivotColumns = this.options.pivotColumns || [];
        this.onQueryHook = this.options.onQuery;
        this.meta = this.options.meta;
    }
    /**
     * Returns the alias for the pivot key
     */
    pivotAlias(key) {
        return `pivot_${key}`;
    }
    /**
     * Clone relationship instance
     */
    clone(parent) {
        return new ManyToMany(this.relationName, this.relatedModel, { ...this.options }, parent);
    }
    /**
     * Boot the relationship and ensure that all keys are in
     * place for queries to do their job.
     */
    boot() {
        if (this.booted) {
            return;
        }
        const relatedModel = this.relatedModel();
        /**
         * Extracting keys from the model and the relation model. The keys
         * extractor ensures all the required columns are defined on
         * the models for the relationship to work
         */
        const { localKey, relatedKey } = new KeysExtractor(this.model, this.relationName, {
            localKey: {
                model: this.model,
                key: this.options.localKey ||
                    this.model.namingStrategy.relationLocalKey(this.type, this.model, relatedModel, this.relationName),
            },
            relatedKey: {
                model: relatedModel,
                key: this.options.relatedKey ||
                    this.model.namingStrategy.relationLocalKey(this.type, this.model, relatedModel, this.relationName),
            },
        }).extract();
        this.pivotTable =
            this.options.pivotTable ||
                this.model.namingStrategy.relationPivotTable(this.type, this.model, relatedModel, this.relationName);
        /**
         * Keys on the parent model
         */
        this.localKey = localKey.attributeName;
        this.localKeyColumnName = localKey.columnName;
        /**
         * Keys on the related model
         */
        this.relatedKey = relatedKey.attributeName;
        this.relatedKeyColumnName = relatedKey.columnName;
        /**
         * Parent model foreign key in the pivot table
         */
        this.pivotForeignKey =
            this.options.pivotForeignKey ||
                this.model.namingStrategy.relationPivotForeignKey(this.type, this.model, relatedModel, this.relationName);
        /**
         * Related model foreign key in the pivot table
         */
        this.pivotRelatedForeignKey =
            this.options.pivotRelatedForeignKey ||
                this.model.namingStrategy.relationPivotForeignKey(this.type, relatedModel, this.model, this.relationName);
        /**
         * Configure pivot timestamps to use. This is a temporary
         * setup. We will have to soon introduce pivot models
         */
        this.computedCreatedAtTimestamp();
        this.computedUpdatedAtTimestamp();
        /**
         * Booted successfully
         */
        this.booted = true;
    }
    /**
     * Set related model instances
     */
    setRelated(parent, related) {
        ensureRelationIsBooted(this);
        parent.$setRelated(this.relationName, related);
    }
    /**
     * Push related model instance(s)
     */
    pushRelated(parent, related) {
        ensureRelationIsBooted(this);
        parent.$pushRelated(this.relationName, related);
    }
    /**
     * Finds and set the related model instances next to the parent
     * models.
     */
    setRelatedForMany(parent, related) {
        ensureRelationIsBooted(this);
        const pivotForeignKeyAlias = this.pivotAlias(this.pivotForeignKey);
        parent.forEach((parentModel) => {
            this.setRelated(parentModel, related.filter((relatedModel) => {
                const value = parentModel[this.localKey];
                return value !== undefined && relatedModel.$extras[pivotForeignKeyAlias] === value;
            }));
        });
    }
    /**
     * Returns an instance of query client for invoking queries
     */
    client(parent, client) {
        ensureRelationIsBooted(this);
        return new ManyToManyQueryClient(this, parent, client);
    }
    /**
     * Returns an instance of eager query builder
     */
    eagerQuery(parent, client) {
        ensureRelationIsBooted(this);
        return ManyToManyQueryClient.eagerQuery(client, this, parent);
    }
    /**
     * Returns instance of query builder
     */
    subQuery(client) {
        ensureRelationIsBooted(this);
        return ManyToManyQueryClient.subQuery(client, this);
    }
    /**
     * Returns key-value pair for the pivot table in relation to the parent model
     */
    getPivotPair(parent) {
        return [this.pivotForeignKey, getValue(parent, this.localKey, this, 'persist')];
    }
    /**
     * Returns key-value pair for the pivot table in relation to the related model
     */
    getPivotRelatedPair(related) {
        return [this.pivotRelatedForeignKey, getValue(related, this.relatedKey, this, 'persist')];
    }
}
