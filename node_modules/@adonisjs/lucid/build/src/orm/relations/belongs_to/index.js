/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { KeysExtractor } from '../keys_extractor.js';
import { BelongsToQueryClient } from './query_client.js';
import { ensureRelationIsBooted, getValue } from '../../../utils/index.js';
/**
 * Manages loading and persisting belongs to relationship
 */
export class BelongsTo {
    relationName;
    relatedModel;
    options;
    model;
    /**
     * Relationship name
     */
    type = 'belongsTo';
    /**
     * Whether or not the relationship instance has been booted
     */
    booted = false;
    /**
     * The key name for serializing the relationship
     */
    serializeAs;
    /**
     * Reference to the onQuery hook defined by the user
     */
    onQueryHook;
    constructor(relationName, relatedModel, options, model) {
        this.relationName = relationName;
        this.relatedModel = relatedModel;
        this.options = options;
        this.model = model;
        this.onQueryHook = this.options.onQuery;
        this.serializeAs =
            this.options.serializeAs === undefined ? this.relationName : this.options.serializeAs;
        this.meta = this.options.meta;
    }
    /**
     * Clone relationship instance
     */
    clone(parent) {
        return new BelongsTo(this.relationName, this.relatedModel, { ...this.options }, parent);
    }
    /**
     * Returns a boolean telling if the related row belongs to the parent
     * row or not.
     */
    isRelatedRow(parent, related) {
        return (related[this.localKey] !== undefined &&
            parent[this.foreignKey] === related[this.localKey]);
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
        const { localKey, foreignKey } = new KeysExtractor(this.model, this.relationName, {
            localKey: {
                model: relatedModel,
                key: this.options.localKey ||
                    this.model.namingStrategy.relationLocalKey(this.type, this.model, relatedModel, this.relationName),
            },
            foreignKey: {
                model: this.model,
                key: this.options.foreignKey ||
                    this.model.namingStrategy.relationForeignKey(this.type, this.model, relatedModel, this.relationName),
            },
        }).extract();
        /**
         * Keys on the related model
         */
        this.localKey = localKey.attributeName;
        this.localKeyColumnName = localKey.columnName;
        /**
         * Keys on the parent model
         */
        this.foreignKey = foreignKey.attributeName;
        this.foreignKeyColumnName = foreignKey.columnName;
        /**
         * Booted successfully
         */
        this.booted = true;
    }
    /**
     * Set related model instance
     */
    setRelated(parent, related) {
        ensureRelationIsBooted(this);
        if (related === undefined) {
            return;
        }
        parent.$setRelated(this.relationName, related);
    }
    /**
     * Push related model instance
     */
    pushRelated(parent, related) {
        ensureRelationIsBooted(this);
        if (related === undefined) {
            return;
        }
        parent.$setRelated(this.relationName, related);
    }
    /**
     * Finds and set the related model instance next to the parent
     * models.
     */
    setRelatedForMany(parent, related) {
        ensureRelationIsBooted(this);
        parent.forEach((parentRow) => {
            const match = related.find((relatedRow) => this.isRelatedRow(parentRow, relatedRow));
            this.setRelated(parentRow, match || null);
        });
    }
    /**
     * Returns an instance of query client for the given relationship
     */
    client(parent, client) {
        ensureRelationIsBooted(this);
        return new BelongsToQueryClient(this, parent, client);
    }
    /**
     * Returns instance of the eager query for the relationship
     */
    eagerQuery(parent, client) {
        ensureRelationIsBooted(this);
        return BelongsToQueryClient.eagerQuery(client, this, parent);
    }
    /**
     * Returns instance of query builder
     */
    subQuery(client) {
        ensureRelationIsBooted(this);
        return BelongsToQueryClient.subQuery(client, this);
    }
    /**
     * Hydrates values object for persistance.
     */
    hydrateForPersistance(parent, related) {
        ;
        parent[this.foreignKey] = getValue(related, this.localKey, this, 'associate');
    }
}
