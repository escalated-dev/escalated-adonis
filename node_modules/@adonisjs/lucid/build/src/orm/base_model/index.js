/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { DateTime } from 'luxon';
import Hooks from '@poppinss/hooks';
import lodash from '@poppinss/utils/lodash';
import { Exception, defineStaticProperty } from '@poppinss/utils';
import * as errors from '../../errors.js';
import { Preloader } from '../preloader/index.js';
import { proxyHandler } from './proxy_handler.js';
import { ModelKeys } from '../model_keys/index.js';
import { HasOne } from '../relations/has_one/index.js';
import { HasMany } from '../relations/has_many/index.js';
import { BelongsTo } from '../relations/belongs_to/index.js';
import { ManyToMany } from '../relations/many_to_many/index.js';
import { HasManyThrough } from '../relations/has_many_through/index.js';
import { CamelCaseNamingStrategy } from '../naming_strategies/camel_case.js';
import { LazyLoadAggregates } from '../relations/aggregates_loader/lazy_load.js';
import { isObject, collectValues, ensureRelation, managedTransaction, normalizeCherryPickObject, transformDateValue, compareValues, } from '../../utils/index.js';
const MANY_RELATIONS = ['hasMany', 'manyToMany', 'hasManyThrough'];
const DATE_TIME_TYPES = {
    date: 'date',
    datetime: 'datetime',
};
const INTERNAL_INSTANCE_PROPERTIES = new Set([
    '$columns',
    '$attributes',
    '$original',
    '$preloaded',
    '$extras',
    '$sideloaded',
    '$isPersisted',
    '$isDeleted',
    '$isLocal',
    'modelOptions',
    'modelTrx',
    'transactionListener',
    'fillInvoked',
    'cachedGetters',
    'forceUpdate',
]);
function StaticImplements() {
    return (_t) => { };
}
/**
 * Abstract class to define fully fledged data models
 */
let BaseModelImpl = class BaseModelImpl {
    /**
     * The adapter to be used for persisting and fetching data.
     *
     * NOTE: Adapter is a singleton and share among all the models, unless
     * a user wants to swap the adapter for a given model
     */
    static $adapter;
    /**
     * Define an adapter to use for interacting with
     * the database
     */
    static useAdapter(adapter) {
        this.$adapter = adapter;
    }
    /**
     * Naming strategy for model properties
     */
    static namingStrategy = new CamelCaseNamingStrategy();
    /**
     * Primary key is required to build relationships across models
     */
    static primaryKey;
    /**
     * Whether the model has been booted. Booting the model initializes its
     * static properties. Base models must not be initialized.
     */
    static booted;
    /**
     * Query scopes defined on the model
     */
    static $queryScopes = {};
    /**
     * A set of properties marked as computed. Computed properties are included in
     * the `toJSON` result, else they behave the same way as any other instance
     * property.
     */
    static $computedDefinitions;
    /**
     * Columns makes it easier to define extra props on the model
     * and distinguish them with the attributes to be sent
     * over to the adapter
     */
    static $columnsDefinitions;
    /**
     * Registered relationships for the given model
     */
    static $relationsDefinitions;
    /**
     * The name of database table. It is auto generated from the model name, unless
     * specified
     */
    static table;
    /**
     * Self assign the primary instead of relying on the database to
     * return it back
     */
    static selfAssignPrimaryKey;
    /**
     * A custom connection to use for queries. The connection defined on
     * query builder is preferred over the model connection
     */
    static connection;
    /**
     * Storing model hooks
     */
    static $hooks;
    /**
     * Keys mappings to make the lookups easy
     */
    static $keys;
    /**
     * Creates a new model instance with payload and adapter options
     */
    static newUpWithOptions(payload, options, allowExtraProperties) {
        const row = new this();
        row.merge(payload, allowExtraProperties);
        /**
         * Pass client options to the newly created row. If row was found
         * the query builder will set the same options.
         */
        row.$setOptionsAndTrx(options);
        return row;
    }
    /**
     * Helper method for `fetchOrNewUpMany`, `fetchOrCreateMany` and `createOrUpdate`
     * many.
     */
    static newUpIfMissing(rowObjects, existingRows, keys, mergeAttribute, options, allowExtraProperties) {
        /**
         * Return existing or create missing rows in the same order as the original
         * array
         */
        return rowObjects.map((rowObject) => {
            const existingRow = existingRows.find((row) => {
                return keys.every((key) => {
                    const objectValue = rowObject[key];
                    const rowValue = row[key];
                    return compareValues(rowValue, objectValue);
                });
            });
            /**
             * Return the row found from the select call
             */
            if (existingRow) {
                if (mergeAttribute) {
                    existingRow.merge(rowObject, allowExtraProperties);
                }
                return existingRow;
            }
            /**
             * Otherwise create a new one
             */
            return this.newUpWithOptions(rowObject, options, allowExtraProperties);
        });
    }
    /**
     * Returns the model query instance for the given model
     */
    static query(options) {
        return this.$adapter.query(this, options);
    }
    static async transaction(callbackOrOptions, options) {
        if (typeof callbackOrOptions === 'function') {
            const client = this.$adapter.modelConstructorClient(this, options);
            return client.transaction(callbackOrOptions, options);
        }
        const client = this.$adapter.modelConstructorClient(this, callbackOrOptions);
        return client.transaction(callbackOrOptions);
    }
    /**
     * Create a model instance from the adapter result. The result value must
     * be a valid object, otherwise `null` is returned.
     */
    static $createFromAdapterResult(adapterResult, sideloadAttributes, options) {
        if (typeof adapterResult !== 'object' || Array.isArray(adapterResult)) {
            return null;
        }
        const instance = new this();
        instance.$consumeAdapterResult(adapterResult, sideloadAttributes);
        instance.$hydrateOriginals();
        instance.$setOptionsAndTrx(options);
        instance.$isPersisted = true;
        instance.$isLocal = false;
        return instance;
    }
    /**
     * Creates an array of models from the adapter results. The `adapterResults`
     * must be an array with valid Javascript objects.
     *
     * 1. If top level value is not an array, then an empty array is returned.
     * 2. If row is not an object, then it will be ignored.
     */
    static $createMultipleFromAdapterResult(adapterResults, sideloadAttributes, options) {
        if (!Array.isArray(adapterResults)) {
            return [];
        }
        return adapterResults.reduce((models, row) => {
            if (isObject(row)) {
                models.push(this.$createFromAdapterResult(row, sideloadAttributes, options));
            }
            return models;
        }, []);
    }
    /**
     * Define a new column on the model. This is required, so that
     * we differentiate between plain properties vs model attributes.
     */
    static $addColumn(name, options) {
        const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name);
        const column = {
            isPrimary: options.isPrimary || false,
            columnName: options.columnName || this.namingStrategy.columnName(this, name),
            hasGetter: !!(descriptor && descriptor.get),
            hasSetter: !!(descriptor && descriptor.set),
            serializeAs: options.serializeAs !== undefined
                ? options.serializeAs
                : this.namingStrategy.serializedName(this, name),
            serialize: options.serialize,
            prepare: options.prepare,
            consume: options.consume,
            meta: options.meta,
        };
        /**
         * Set column as the primary column, when `primary` is true
         */
        if (column.isPrimary) {
            this.primaryKey = name;
        }
        this.$columnsDefinitions.set(name, column);
        this.$keys.attributesToColumns.add(name, column.columnName);
        column.serializeAs && this.$keys.attributesToSerialized.add(name, column.serializeAs);
        this.$keys.columnsToAttributes.add(column.columnName, name);
        column.serializeAs && this.$keys.columnsToSerialized.add(column.columnName, column.serializeAs);
        column.serializeAs && this.$keys.serializedToAttributes.add(column.serializeAs, name);
        column.serializeAs && this.$keys.serializedToColumns.add(column.serializeAs, column.columnName);
        return column;
    }
    /**
     * Returns a boolean telling if column exists on the model
     */
    static $hasColumn(name) {
        return this.$columnsDefinitions.has(name);
    }
    /**
     * Returns the column for a given name
     */
    static $getColumn(name) {
        return this.$columnsDefinitions.get(name);
    }
    /**
     * Adds a computed node
     */
    static $addComputed(name, options) {
        const computed = {
            serializeAs: options.serializeAs !== undefined
                ? options.serializeAs
                : this.namingStrategy.serializedName(this, name),
            meta: options.meta,
        };
        this.$computedDefinitions.set(name, computed);
        return computed;
    }
    /**
     * Find if some property is marked as computed
     */
    static $hasComputed(name) {
        return this.$computedDefinitions.has(name);
    }
    /**
     * Get computed node
     */
    static $getComputed(name) {
        return this.$computedDefinitions.get(name);
    }
    /**
     * Register has one relationship
     */
    static $addHasOne(name, relatedModel, options) {
        this.$relationsDefinitions.set(name, new HasOne(name, relatedModel, options, this));
    }
    /**
     * Register has many relationship
     */
    static $addHasMany(name, relatedModel, options) {
        this.$relationsDefinitions.set(name, new HasMany(name, relatedModel, options, this));
    }
    /**
     * Register belongs to relationship
     */
    static $addBelongsTo(name, relatedModel, options) {
        this.$relationsDefinitions.set(name, new BelongsTo(name, relatedModel, options, this));
    }
    /**
     * Register many-to-many relationship
     */
    static $addManyToMany(name, relatedModel, options) {
        this.$relationsDefinitions.set(name, new ManyToMany(name, relatedModel, options, this));
    }
    /**
     * Register has many through relationship
     */
    static $addHasManyThrough(name, relatedModel, options) {
        this.$relationsDefinitions.set(name, new HasManyThrough(name, relatedModel, options, this));
    }
    /**
     * Adds a relationship
     */
    static $addRelation(name, type, relatedModel, options) {
        switch (type) {
            case 'hasOne':
                this.$addHasOne(name, relatedModel, options);
                break;
            case 'hasMany':
                this.$addHasMany(name, relatedModel, options);
                break;
            case 'belongsTo':
                this.$addBelongsTo(name, relatedModel, options);
                break;
            case 'manyToMany':
                this.$addManyToMany(name, relatedModel, options);
                break;
            case 'hasManyThrough':
                this.$addHasManyThrough(name, relatedModel, options);
                break;
            default:
                throw new Error(`${type} is not a supported relation type`);
        }
    }
    /**
     * Find if some property is marked as a relation or not
     */
    static $hasRelation(name) {
        return this.$relationsDefinitions.has(name);
    }
    /**
     * Returns relationship node for a given relation
     */
    static $getRelation(name) {
        return this.$relationsDefinitions.get(name);
    }
    /**
     * Define a static property on the model using the inherit or
     * define strategy.
     *
     * Inherit strategy will clone the property from the parent model
     * and will set it on the current model
     */
    static $defineProperty(propertyName, defaultValue, strategy) {
        defineStaticProperty(this, propertyName, {
            initialValue: defaultValue,
            strategy: strategy,
        });
    }
    /**
     * Boot the model
     */
    static boot() {
        /**
         * Define the property when not defined on self
         */
        if (!this.hasOwnProperty('booted')) {
            this.booted = false;
        }
        /**
         * Return when already booted
         */
        if (this.booted === true) {
            return;
        }
        this.booted = true;
        /**
         * Table name is never inherited from the base model
         */
        this.$defineProperty('table', this.namingStrategy.tableName(this), 'define');
        /**
         * Inherit primary key or default to "id"
         */
        this.$defineProperty('primaryKey', 'id', 'inherit');
        /**
         * Inherit selfAssignPrimaryKey or default to "false"
         */
        this.$defineProperty('selfAssignPrimaryKey', false, 'inherit');
        /**
         * Define the keys' property. This allows looking up variations
         * for model keys
         */
        this.$defineProperty('$keys', {
            attributesToColumns: new ModelKeys(),
            attributesToSerialized: new ModelKeys(),
            columnsToAttributes: new ModelKeys(),
            columnsToSerialized: new ModelKeys(),
            serializedToColumns: new ModelKeys(),
            serializedToAttributes: new ModelKeys(),
        }, (value) => {
            return {
                attributesToColumns: new ModelKeys(Object.assign({}, value.attributesToColumns.all())),
                attributesToSerialized: new ModelKeys(Object.assign({}, value.attributesToSerialized.all())),
                columnsToAttributes: new ModelKeys(Object.assign({}, value.columnsToAttributes.all())),
                columnsToSerialized: new ModelKeys(Object.assign({}, value.columnsToSerialized.all())),
                serializedToColumns: new ModelKeys(Object.assign({}, value.serializedToColumns.all())),
                serializedToAttributes: new ModelKeys(Object.assign({}, value.serializedToAttributes.all())),
            };
        });
        /**
         * Define columns
         */
        this.$defineProperty('$columnsDefinitions', new Map(), 'inherit');
        /**
         * Define computed properties
         */
        this.$defineProperty('$computedDefinitions', new Map(), 'inherit');
        /**
         * Define relationships
         */
        this.$defineProperty('$relationsDefinitions', new Map(), (value) => {
            const relations = new Map();
            value.forEach((relation, key) => {
                const relationClone = relation.clone(this);
                relations.set(key, relationClone);
            });
            return relations;
        });
        /**
         * Define hooks.
         */
        this.$defineProperty('$hooks', new Hooks(), (value) => {
            const hooks = new Hooks();
            hooks.merge(value);
            return hooks;
        });
    }
    static before(event, handler) {
        this.$hooks.add(`before:${event}`, handler);
    }
    static after(event, handler) {
        this.$hooks.add(`after:${event}`, handler);
    }
    /**
     * Returns a fresh persisted instance of model by applying
     * attributes to the model instance
     */
    static async create(values, options) {
        const instance = this.newUpWithOptions(values, options, options?.allowExtraProperties);
        await instance.save();
        return instance;
    }
    /**
     * Same as [[BaseModel.create]] without invoking hooks.
     */
    static async createQuietly(values, options) {
        const instance = this.newUpWithOptions(values, options, options?.allowExtraProperties);
        await instance.saveQuietly();
        return instance;
    }
    /**
     * Same as [[BaseModel.create]], but persists multiple instances. The create
     * many call will be wrapped inside a managed transaction for consistency.
     * If required, you can also pass a transaction client and the method
     * will use that instead of create a new one.
     */
    static async createMany(values, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        return managedTransaction(client, async (trx) => {
            const modelInstances = [];
            const createOptions = {
                client: trx,
                allowExtraProperties: options?.allowExtraProperties,
            };
            for (let row of values) {
                const modelInstance = await this.create(row, createOptions);
                modelInstances.push(modelInstance);
            }
            return modelInstances;
        });
    }
    /**
     * Same as [[BaseModel.createMany]] without invoking hooks.
     */
    static async createManyQuietly(values, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        return managedTransaction(client, async (trx) => {
            const modelInstances = [];
            const createOptions = {
                client: trx,
                allowExtraProperties: options?.allowExtraProperties,
            };
            for (let row of values) {
                const modelInstance = await this.createQuietly(row, createOptions);
                modelInstances.push(modelInstance);
            }
            return modelInstances;
        });
    }
    /**
     * Find model instance using the primary key
     */
    static async find(value, options) {
        if (value === undefined) {
            throw new Exception('"find" expects a value. Received undefined');
        }
        return this.findBy(this.primaryKey, value, options);
    }
    /**
     * Find model instance using the primary key
     */
    static async findOrFail(value, options) {
        if (value === undefined) {
            throw new Exception('"findOrFail" expects a value. Received undefined');
        }
        return this.findByOrFail(this.primaryKey, value, options);
    }
    static async findBy(key, value, options) {
        if (typeof key === 'object') {
            return this.query(value)
                .where(key)
                .first();
        }
        if (value === undefined) {
            throw new Exception('"findBy" expects a value. Received undefined');
        }
        return this.query(options).where(key, value).first();
    }
    static async findByOrFail(key, value, options) {
        if (typeof key === 'object') {
            return this.query(value)
                .where(key)
                .firstOrFail();
        }
        if (value === undefined) {
            throw new Exception('"findByOrFail" expects a value. Received undefined');
        }
        return this.query(options).where(key, value).firstOrFail();
    }
    static findManyBy(key, value, options) {
        if (typeof key === 'object') {
            return this.query(value)
                .where(key)
                .exec();
        }
        if (value === undefined) {
            throw new Exception('"findManyBy" expects a value. Received undefined');
        }
        return this.query(options).where(key, value).exec();
    }
    /**
     * Same as `query().first()`
     */
    static async first(options) {
        return this.query(options).first();
    }
    /**
     * Same as `query().firstOrFail()`
     */
    static async firstOrFail(options) {
        return this.query(options).firstOrFail();
    }
    /**
     * Find model instance using a key/value pair
     */
    static async findMany(value, options) {
        if (value === undefined) {
            throw new Exception('"findMany" expects a value. Received undefined');
        }
        return this.query(options)
            .whereIn(this.primaryKey, value)
            .orderBy(this.primaryKey, 'desc')
            .exec();
    }
    /**
     * Find model instance using a key/value pair or create a
     * new one without persisting it.
     */
    static async firstOrNew(searchPayload, savePayload, options) {
        /**
         * Search using the search payload and fetch the first row
         */
        const query = this.query(options).where(searchPayload);
        const row = await query.first();
        /**
         * Create a new one, if row is not found
         */
        if (!row) {
            return this.newUpWithOptions(Object.assign({}, searchPayload, savePayload), query.clientOptions, options?.allowExtraProperties);
        }
        return row;
    }
    /**
     * Same as `firstOrNew`, but also persists the newly created model instance.
     */
    static async firstOrCreate(searchPayload, savePayload, options) {
        /**
         * Search using the search payload and fetch the first row
         */
        const query = this.query(options).where(searchPayload);
        let row = await query.first();
        /**
         * Create a new instance and persist it to the database
         */
        if (!row) {
            row = this.newUpWithOptions(Object.assign({}, searchPayload, savePayload), query.clientOptions, options?.allowExtraProperties);
            await row.save();
        }
        return row;
    }
    /**
     * Updates or creates a new row inside the database
     */
    static async updateOrCreate(searchPayload, updatedPayload, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        /**
         * We wrap updateOrCreate call inside a transaction and obtain an update
         * lock on the selected row. This ensures that concurrent reads waits
         * for the existing writes to finish
         */
        return managedTransaction(client, async (trx) => {
            const query = this.query({ client: trx }).forUpdate().where(searchPayload);
            let row = await query.first();
            /**
             * Create a new instance or update the existing one (if found)
             */
            if (!row) {
                row = this.newUpWithOptions(Object.assign({}, searchPayload, updatedPayload), query.clientOptions, options?.allowExtraProperties);
            }
            else {
                row.merge(updatedPayload, options?.allowExtraProperties);
            }
            await row.save();
            return row;
        });
    }
    /**
     * Find existing rows or create an in-memory instances of the missing ones.
     */
    static async fetchOrNewUpMany(uniqueKeys, payload, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        uniqueKeys = Array.isArray(uniqueKeys) ? uniqueKeys : [uniqueKeys];
        const uniquenessPair = uniqueKeys.map((uniqueKey) => {
            return {
                key: uniqueKey,
                value: collectValues(payload, uniqueKey, () => {
                    throw new Exception(`Value for the "${uniqueKey}" is null or undefined inside "fetchOrNewUpMany" payload`);
                }).map((value) => transformDateValue(value, client.dialect)),
            };
        });
        /**
         * Find existing rows
         */
        const query = this.query(options);
        uniquenessPair.forEach(({ key, value }) => query.whereIn(key, value));
        const existingRows = await query;
        /**
         * Return existing rows as it is and create a model instance for missing one's
         */
        return this.newUpIfMissing(payload, existingRows, uniqueKeys, false, query.clientOptions, options?.allowExtraProperties);
    }
    /**
     * Find existing rows or create missing one's. One database call per insert
     * is invoked, so that each insert goes through the lifecycle of model
     * hooks.
     */
    static async fetchOrCreateMany(uniqueKeys, payload, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        uniqueKeys = Array.isArray(uniqueKeys) ? uniqueKeys : [uniqueKeys];
        const uniquenessPair = uniqueKeys.map((uniqueKey) => {
            return {
                key: uniqueKey,
                value: collectValues(payload, uniqueKey, () => {
                    throw new Exception(`Value for the "${uniqueKey}" is null or undefined inside "fetchOrCreateMany" payload`);
                }).map((value) => transformDateValue(value, client.dialect)),
            };
        });
        /**
         * Find existing rows
         */
        const query = this.query(options);
        uniquenessPair.forEach(({ key, value }) => query.whereIn(key, value));
        const existingRows = await query;
        /**
         * Create model instance for the missing rows
         */
        const rows = this.newUpIfMissing(payload, existingRows, uniqueKeys, false, query.clientOptions, options?.allowExtraProperties);
        /**
         * Persist inside db inside a transaction
         */
        await managedTransaction(query.client, async (trx) => {
            for (let row of rows) {
                /**
                 * If transaction `client` was passed, then the row will have
                 * the `trx` already set. But since, the trx of row will be
                 * same as the `trx` passed to this callback, we can safely
                 * re-set it.
                 */
                row.$trx = trx;
                if (!row.$isPersisted) {
                    await row.save();
                }
            }
        });
        return rows;
    }
    /**
     * Update existing rows or create missing one's. One database call per insert
     * is invoked, so that each insert and update goes through the lifecycle
     * of model hooks.
     */
    static async updateOrCreateMany(uniqueKeys, payload, options) {
        const client = this.$adapter.modelConstructorClient(this, options);
        uniqueKeys = Array.isArray(uniqueKeys) ? uniqueKeys : [uniqueKeys];
        const uniquenessPair = uniqueKeys.map((uniqueKey) => {
            return {
                key: uniqueKey,
                value: collectValues(payload, uniqueKey, () => {
                    throw new Exception(`Value for the "${uniqueKey}" is null or undefined inside "updateOrCreateMany" payload`);
                }).map((value) => transformDateValue(value, client.dialect)),
            };
        });
        return managedTransaction(client, async (trx) => {
            /**
             * Find existing rows
             */
            const query = this.query({ client: trx }).forUpdate();
            uniquenessPair.forEach(({ key, value }) => query.whereIn(key, value));
            const existingRows = await query;
            /**
             * Create model instance for the missing rows
             */
            const rows = this.newUpIfMissing(payload, existingRows, uniqueKeys, true, query.clientOptions, options?.allowExtraProperties);
            for (let row of rows) {
                await row.save();
            }
            return rows;
        });
    }
    /**
     * Returns all rows from the model table
     */
    static async all(options) {
        return this.query(options).orderBy(this.primaryKey, 'desc');
    }
    /**
     * Truncate model table
     */
    static truncate(cascade = false) {
        return this.query().client.truncate(this.table, cascade);
    }
    constructor() {
        return new Proxy(this, proxyHandler);
    }
    /**
     * Custom options defined on the model instance that are
     * passed to the adapter
     */
    modelOptions;
    /**
     * Reference to transaction that will be used for performing queries on a given
     * model instance.
     */
    modelTrx;
    /**
     * The transaction listener listens for the `commit` and `rollback` events and
     * cleanup the `$trx` reference
     */
    transactionListener = function listener() {
        this.modelTrx = undefined;
    }.bind(this);
    /**
     * When `fill` method is called, then we may have a situation where it
     * removed the values which exists in `original` and hence the dirty
     * diff has to do a negative diff as well
     */
    fillInvoked = false;
    /**
     * A copy of cached getters
     */
    cachedGetters = {};
    /**
     * Find if force updates are enabled
     */
    forceUpdate = false;
    /**
     * Raises exception when mutations are performed on a delete model
     */
    ensureIsntDeleted() {
        if (this.$isDeleted) {
            throw new errors.E_MODEL_DELETED();
        }
    }
    /**
     * Invoked when performing the insert call. The method initiates
     * all `datetime` columns, if there are not initiated already
     * and `autoCreate` or `autoUpdate` flags are turned on.
     */
    initiateAutoCreateColumns() {
        const model = this.constructor;
        model.$columnsDefinitions.forEach((column, attributeName) => {
            const columnType = column.meta?.type;
            /**
             * Return early when not dealing with date time columns
             */
            if (!columnType || !(columnType in DATE_TIME_TYPES)) {
                return;
            }
            /**
             * Set the value when its missing and `autoCreate` or `autoUpdate`
             * flags are defined.
             */
            const attributeValue = this[attributeName];
            if (!attributeValue && (column.meta.autoCreate || column.meta.autoUpdate)) {
                ;
                this[attributeName] = DateTime.local();
                return;
            }
        });
    }
    /**
     * Invoked when performing the update call. The method initiates
     * all `datetime` columns, if there have `autoUpdate` flag
     * turned on.
     */
    initiateAutoUpdateColumns() {
        const model = this.constructor;
        model.$columnsDefinitions.forEach((column, attributeName) => {
            const columnType = column.meta?.type;
            /**
             * Return early when not dealing with date time columns or auto update
             * is not set to true
             */
            if (!columnType || !(columnType in DATE_TIME_TYPES) || !column.meta.autoUpdate) {
                return;
            }
            ;
            this[attributeName] = DateTime.local();
        });
    }
    /**
     * Preparing the object to be sent to the adapter. We need
     * to create the object with the property names to be
     * used by the adapter.
     */
    prepareForAdapter(attributes) {
        const Model = this.constructor;
        return Object.keys(attributes).reduce((result, key) => {
            const column = Model.$getColumn(key);
            const value = typeof column.prepare === 'function'
                ? column.prepare(attributes[key], key, this)
                : attributes[key];
            result[column.columnName] = value;
            return result;
        }, {});
    }
    /**
     * Returns true when the field must be included
     * inside the serialized object.
     */
    shouldSerializeField(serializeAs, fields) {
        /**
         * If explicit serializing is turned off, then never
         * return the field
         */
        if (!serializeAs) {
            return false;
        }
        /**
         * If not explicit fields are defined, then always include the field
         */
        if (!fields) {
            return true;
        }
        const { pick, omit } = normalizeCherryPickObject(fields);
        /**
         * Return false, when under omit array
         */
        if (omit && omit.includes(serializeAs)) {
            return false;
        }
        /**
         * Otherwise ensure is inside pick array
         */
        return !pick || pick.includes(serializeAs);
    }
    /**
     * A type only reference to the columns
     */
    $columns = {};
    /**
     * A copy of attributes that will be sent over to adapter
     */
    $attributes = {};
    /**
     * Original represents the properties that already has been
     * persisted or loaded by the adapter.
     */
    $original = {};
    /**
     * Preloaded relationships on the model instance
     */
    $preloaded = {};
    /**
     * Extras are dynamic properties set on the model instance, which
     * are not serialized and neither cast for adapter calls.
     *
     * This is helpful when adapter wants to load some extra data conditionally
     * and that data must not be persisted back the adapter.
     */
    $extras = {};
    /**
     * Side-loaded are dynamic properties set on the model instance, which
     * are not serialized and neither cast for adapter calls.
     *
     * This is helpful when you want to add dynamic metadata to the model
     * and it's children as well.
     *
     * The difference between [[extras]] and [[sideloaded]] is:
     *
     * - Extras can be different for each model instance
     * - Extras are not shared down the hierarchy (example relationships)
     * - Side-loaded are shared across multiple model instances created via `$createMultipleFromAdapterResult`.
     * - Side-loaded are passed to the relationships as well.
     */
    $sideloaded = {};
    /**
     * Persisted means the model has been persisted with the adapter. This will
     * also be true, when model instance is created as a result of fetch
     * call from the adapter.
     */
    $isPersisted = false;
    /**
     * Once deleted the model instance cannot make calls to the adapter
     */
    $isDeleted = false;
    /**
     * `$isLocal` tells if the model instance was created locally vs
     * one generated as a result of fetch call from the adapter.
     */
    $isLocal = true;
    /**
     * Returns the value of primary key. The value must be
     * set inside attributes object
     */
    get $primaryKeyValue() {
        const model = this.constructor;
        const column = model.$getColumn(model.primaryKey);
        if (column && column.hasGetter) {
            return this[model.primaryKey];
        }
        return this.$getAttribute(model.primaryKey);
    }
    /**
     * Opposite of [[this.isPersisted]]
     */
    get $isNew() {
        return !this.$isPersisted;
    }
    /**
     * Returns dirty properties of a model by doing a diff
     * between original values and current attributes
     */
    get $dirty() {
        const processedKeys = [];
        /**
         * Do not compute diff, when model has never been persisted
         */
        if (!this.$isPersisted) {
            return this.$attributes;
        }
        const dirty = Object.keys(this.$attributes).reduce((result, key) => {
            const value = this.$attributes[key];
            const originalValue = this.$original[key];
            let isEqual = true;
            if (isObject(value) && 'isDirty' in value) {
                isEqual = !value.isDirty;
            }
            else {
                isEqual = compareValues(originalValue, value);
            }
            if (!isEqual) {
                result[key] = value;
            }
            if (this.fillInvoked) {
                processedKeys.push(key);
            }
            return result;
        }, {});
        /**
         * Find negative diff if fill was invoked, since we may have removed values
         * that exists in originals
         */
        if (this.fillInvoked) {
            Object.keys(this.$original)
                .filter((key) => !processedKeys.includes(key))
                .forEach((key) => {
                dirty[key] = null;
            });
        }
        return dirty;
    }
    /**
     * Finding if model is dirty with changes or not
     */
    get $isDirty() {
        return Object.keys(this.$dirty).length > 0;
    }
    /**
     * Returns the transaction
     */
    get $trx() {
        return this.modelTrx;
    }
    /**
     * Set the trx to be used by the model to executing queries
     */
    set $trx(trx) {
        if (!trx) {
            this.modelTrx = undefined;
            return;
        }
        /**
         * Remove old listeners
         */
        if (this.modelTrx) {
            this.modelTrx.removeListener('commit', this.transactionListener);
            this.modelTrx.removeListener('rollback', this.transactionListener);
        }
        /**
         * Store reference to the transaction
         */
        this.modelTrx = trx;
        this.modelTrx.once('commit', this.transactionListener);
        this.modelTrx.once('rollback', this.transactionListener);
    }
    /**
     * Get options
     */
    get $options() {
        return this.modelOptions;
    }
    /**
     * Set options
     */
    set $options(options) {
        if (!options) {
            this.modelOptions = undefined;
            return;
        }
        this.modelOptions = this.modelOptions || {};
        if (options.connection) {
            this.modelOptions.connection = options.connection;
        }
    }
    /**
     * Set options on the model instance along with transaction
     */
    $setOptionsAndTrx(options) {
        if (!options) {
            return;
        }
        if (options.client && options.client.isTransaction) {
            this.$trx = options.client;
        }
        this.$options = options;
    }
    /**
     * A chainable method to set transaction on the model
     */
    useTransaction(trx) {
        this.$trx = trx;
        return this;
    }
    /**
     * A chainable method to set transaction on the model
     */
    useConnection(connection) {
        this.$options = { connection };
        return this;
    }
    /**
     * Set attribute
     */
    $setAttribute(key, value) {
        this.ensureIsntDeleted();
        this.$attributes[key] = value;
    }
    /**
     * Get value of attribute
     */
    $getAttribute(key) {
        return this.$attributes[key];
    }
    /**
     * Returns the attribute value from the cache which was resolved by
     * the mutated by a getter. This is done to avoid re-mutating
     * the same attribute value over and over again.
     */
    $getAttributeFromCache(key, callback) {
        const original = this.$getAttribute(key);
        const cached = this.cachedGetters[key];
        /**
         * Return the resolved value from cache when cache original is same
         * as the attribute value
         */
        if (cached && cached.original === original) {
            return cached.resolved;
        }
        /**
         * Re-resolve the value from the callback
         */
        const resolved = callback(original);
        if (!cached) {
            /**
             * Create cache entry
             */
            this.cachedGetters[key] = { getter: callback, original, resolved };
        }
        else {
            /**
             * Update original and resolved keys
             */
            this.cachedGetters[key].original = original;
            this.cachedGetters[key].resolved = resolved;
        }
        return resolved;
    }
    /**
     * Returns the related model or default value when model is missing
     */
    $getRelated(key) {
        return this.$preloaded[key];
    }
    /**
     * A boolean to know if relationship has been preloaded or not
     */
    $hasRelated(key) {
        return this.$preloaded[key] !== undefined;
    }
    /**
     * Sets the related data on the model instance. The method internally handles
     * `one to one` or `many` relations
     */
    $setRelated(key, models) {
        const Model = this.constructor;
        const relation = Model.$relationsDefinitions.get(key);
        /**
         * Ignore when relation is not defined
         */
        if (!relation) {
            return;
        }
        /**
         * Reset array before invoking $pushRelated
         */
        if (MANY_RELATIONS.includes(relation.type)) {
            if (!Array.isArray(models)) {
                throw new Exception(`"${Model.name}.${key}" must be an array when setting "${relation.type}" relationship`);
            }
            this.$preloaded[key] = [];
        }
        return this.$pushRelated(key, models);
    }
    /**
     * Push related adds to the existing related collection
     */
    $pushRelated(key, models) {
        const Model = this.constructor;
        const relation = Model.$relationsDefinitions.get(key);
        /**
         * Ignore when relation is not defined
         */
        if (!relation) {
            return;
        }
        /**
         * Create multiple for `hasMany` `manyToMany` and `hasManyThrough`
         */
        if (MANY_RELATIONS.includes(relation.type)) {
            this.$preloaded[key] = (this.$preloaded[key] || []).concat(models);
            return;
        }
        /**
         * Dis-allow setting multiple model instances for a one-to-one relationship
         */
        if (Array.isArray(models)) {
            throw new Error(`"${Model.name}.${key}" cannot reference more than one instance of "${relation.relatedModel().name}" model`);
        }
        this.$preloaded[key] = models;
    }
    /**
     * Merges the object with the model attributes, assuming object keys
     * are coming the database.
     *
     * 1. If key is unknown, it will be added to the `extras` object.
     * 2. If key is defined as a relationship, it will be ignored and one must call `$setRelated`.
     */
    $consumeAdapterResult(adapterResult, sideloadedAttributes) {
        const Model = this.constructor;
        /**
         * Merging sideloaded attributes with the existing sideloaded values
         * on the model instance
         */
        if (sideloadedAttributes) {
            this.$sideloaded = Object.assign({}, this.$sideloaded, sideloadedAttributes);
        }
        /**
         * Merge result of adapter with the attributes. This enables
         * the adapter to hydrate models with properties generated
         * as a result of insert or update
         */
        if (isObject(adapterResult)) {
            Object.keys(adapterResult).forEach((key) => {
                /**
                 * Pull the attribute name from the column name, since adapter
                 * results always holds the column names.
                 */
                const attributeName = Model.$keys.columnsToAttributes.get(key);
                if (attributeName) {
                    const attribute = Model.$getColumn(attributeName);
                    /**
                     * Invoke `consume` method for the column, before setting the
                     * attribute
                     */
                    const value = typeof attribute.consume === 'function'
                        ? attribute.consume(adapterResult[key], attributeName, this)
                        : adapterResult[key];
                    /**
                     * When consuming the adapter result, we must always set the attributes
                     * directly, as we do not want to invoke setters.
                     */
                    this.$setAttribute(attributeName, value);
                    return;
                }
                /**
                 * If key is defined as a relation, then ignore it, since one
                 * must pass a qualified model to `this.$setRelated()`
                 */
                if (Model.$relationsDefinitions.has(key)) {
                    return;
                }
                /**
                 * Disallow overwriting internal properties via adapter result
                 */
                if (INTERNAL_INSTANCE_PROPERTIES.has(key)) {
                    return;
                }
                /**
                 * Set directly on the model
                 */
                if (this.hasOwnProperty(key)) {
                    ;
                    this[key] = adapterResult[key];
                    return;
                }
                this.$extras[key] = adapterResult[key];
            });
        }
    }
    /**
     * Sync originals with the attributes. After this `isDirty` will
     * return false
     */
    $hydrateOriginals() {
        this.$original = {};
        lodash.merge(this.$original, this.$attributes);
    }
    /**
     * Set bulk attributes on the model instance. Setting relationships via
     * fill isn't allowed, since we disallow setting relationships
     * locally
     */
    fill(values, allowExtraProperties = false) {
        this.$attributes = {};
        this.merge(values, allowExtraProperties);
        this.fillInvoked = true;
        return this;
    }
    /**
     * Merge bulk attributes with existing attributes.
     *
     * 1. If key is unknown, it will be added to the `extras` object.
     * 2. If key is defined as a relationship, it will be ignored and one must call `$setRelated`.
     */
    merge(values, allowExtraProperties = false) {
        const Model = this.constructor;
        /**
         * Merge values with the attributes
         */
        if (isObject(values)) {
            Object.keys(values).forEach((key) => {
                const value = values[key];
                /**
                 * Set as column
                 */
                if (Model.$hasColumn(key)) {
                    ;
                    this[key] = value;
                    return;
                }
                /**
                 * Resolve the attribute name from the column names. Since people
                 * usually define the column names directly as well by
                 * accepting them directly from the API.
                 */
                const attributeName = Model.$keys.columnsToAttributes.get(key);
                if (attributeName) {
                    ;
                    this[attributeName] = value;
                    return;
                }
                /**
                 * If key is defined as a relation, then ignore it, since one
                 * must pass a qualified model to `this.$setRelated()`
                 */
                if (Model.$relationsDefinitions.has(key)) {
                    return;
                }
                /**
                 * Disallow overwriting internal properties via merge
                 */
                if (INTERNAL_INSTANCE_PROPERTIES.has(key)) {
                    return;
                }
                /**
                 * If the property already exists on the model, then set it
                 * as it is vs defining it as an extra property
                 */
                if (this.hasOwnProperty(key)) {
                    ;
                    this[key] = value;
                    return;
                }
                /**
                 * Raise error when not instructed to ignore non-existing properties.
                 */
                if (!allowExtraProperties) {
                    throw new Error(`Cannot define "${key}" on "${Model.name}" model, since it is not defined as a model property`);
                }
                this.$extras[key] = value;
            });
        }
        return this;
    }
    /**
     * Returns whether any of the fields have been modified
     */
    isDirty(fields) {
        const keys = Array.isArray(fields) ? fields : fields ? [fields] : [];
        if (keys.length === 0) {
            return this.$isDirty;
        }
        return keys.some((key) => key in this.$dirty);
    }
    /**
     * Enable force update even when no attributes
     * are dirty
     */
    enableForceUpdate() {
        this.forceUpdate = true;
        return this;
    }
    /**
     * Preloads one or more relationships for the current model
     */
    async load(relationName, callback) {
        this.ensureIsntDeleted();
        if (!this.$isPersisted) {
            throw new Exception('Cannot lazy load relationship for an unpersisted model instance');
        }
        const Model = this.constructor;
        const preloader = new Preloader(Model);
        if (typeof relationName === 'function') {
            relationName(preloader);
        }
        else {
            preloader.load(relationName, callback);
        }
        const queryClient = Model.$adapter.modelClient(this);
        await preloader
            .sideload(this.$sideloaded)
            .debug(queryClient.debug)
            .processAllForOne(this, queryClient);
    }
    /**
     * Load relationships onto the instance, but only if they are not
     * already preloaded
     */
    async loadOnce(relationName) {
        if (!this.$preloaded[relationName]) {
            return this.load(relationName);
        }
    }
    /**
     * @deprecated
     */
    async preload(relationName, callback) {
        process.emitWarning('DeprecationWarning', '"Model.preload()" is deprecated. Use "Model.load()" instead');
        return this.load(relationName, callback);
    }
    /**
     * Lazy load the relationship aggregate value
     */
    loadAggregate(relationName, callback) {
        this.ensureIsntDeleted();
        if (!this.$isPersisted) {
            throw new Exception('Cannot lazy load relationship aggregates for an unpersisted model instance');
        }
        return new LazyLoadAggregates(this).loadAggregate(relationName, callback);
    }
    /**
     * Lazy load the relationship count value
     */
    loadCount(relationName, callback) {
        this.ensureIsntDeleted();
        if (!this.$isPersisted) {
            throw new Exception('Cannot lazy load relationship aggregates for an unpersisted model instance');
        }
        return new LazyLoadAggregates(this).loadCount(relationName, callback);
    }
    /**
     * Perform save on the model instance to commit mutations.
     */
    async save() {
        this.ensureIsntDeleted();
        const Model = this.constructor;
        /**
         * Persist the model when it's not persisted already
         */
        if (!this.$isPersisted) {
            await Model.$hooks.runner('before:create').run(this);
            await Model.$hooks.runner('before:save').run(this);
            this.initiateAutoCreateColumns();
            await Model.$adapter.insert(this, this.prepareForAdapter(this.$attributes));
            this.$hydrateOriginals();
            this.$isPersisted = true;
            await Model.$hooks.runner('after:create').run(this);
            await Model.$hooks.runner('after:save').run(this);
            return this;
        }
        /**
         * Call hooks beforehand, so that they have the chance
         * to make mutations that produces one or more `$dirty`
         * fields.
         */
        await Model.$hooks.runner('before:update').run(this);
        await Model.$hooks.runner('before:save').run(this);
        const forceUpdate = this.forceUpdate;
        this.forceUpdate = false;
        /**
         * Do not issue updates when model doesn't have any mutations
         */
        if (!this.$isDirty && !forceUpdate) {
            return this;
        }
        /**
         * Perform update
         */
        this.initiateAutoUpdateColumns();
        const updatePayload = this.prepareForAdapter(this.$dirty);
        if (Object.keys(updatePayload).length > 0) {
            await Model.$adapter.update(this, updatePayload);
        }
        this.$hydrateOriginals();
        await Model.$hooks.runner('after:update').run(this);
        await Model.$hooks.runner('after:save').run(this);
        return this;
    }
    /**
     * Same as [[BaseModel.save]] without invoking hooks.
     */
    async saveQuietly() {
        this.ensureIsntDeleted();
        const Model = this.constructor;
        /**
         * Persist the model when it's not persisted already
         */
        if (!this.$isPersisted) {
            this.initiateAutoCreateColumns();
            await Model.$adapter.insert(this, this.prepareForAdapter(this.$attributes));
            this.$hydrateOriginals();
            this.$isPersisted = true;
            return this;
        }
        /**
         * Call hooks beforehand, so that they have the chance
         * to make mutations that produces one or more `$dirty`
         * fields.
         */
        const forceUpdate = this.forceUpdate;
        this.forceUpdate = false;
        /**
         * Do not issue updates when model doesn't have any mutations
         */
        if (!this.$isDirty && !forceUpdate) {
            return this;
        }
        /**
         * Perform update
         */
        this.initiateAutoUpdateColumns();
        const updatePayload = this.prepareForAdapter(this.$dirty);
        if (Object.keys(updatePayload).length > 0) {
            await Model.$adapter.update(this, updatePayload);
        }
        this.$hydrateOriginals();
        return this;
    }
    /**
     * The lockForUpdate method re-fetches the model instance from
     * the database and locks the row to perform an update. The
     * provided callback receives a fresh user instance and should
     * use that to perform an update.
     */
    async lockForUpdate(callback) {
        const Model = this.constructor;
        const queryClient = Model.$adapter.modelClient(this);
        return managedTransaction(queryClient, async (trx) => {
            const user = await Model.query({ client: trx })
                .forUpdate()
                .where(Model.primaryKey, this.$primaryKeyValue)
                .first();
            if (!user) {
                throw new errors.E_MODEL_DELETED();
            }
            return callback(user);
        });
    }
    /**
     * Perform delete by issuing a delete request on the adapter
     */
    async delete() {
        this.ensureIsntDeleted();
        const Model = this.constructor;
        await Model.$hooks.runner('before:delete').run(this);
        await Model.$adapter.delete(this);
        this.$isDeleted = true;
        await Model.$hooks.runner('after:delete').run(this);
    }
    /**
     * Same as [[BaseModel.delete]] without invoking hooks.
     */
    async deleteQuietly() {
        this.ensureIsntDeleted();
        const Model = this.constructor;
        await Model.$adapter.delete(this);
        this.$isDeleted = true;
    }
    /**
     * Serializes model attributes to a plain object
     */
    serializeAttributes(fields, raw = false) {
        const Model = this.constructor;
        return Object.keys(this.$attributes).reduce((result, key) => {
            const column = Model.$getColumn(key);
            if (!this.shouldSerializeField(column.serializeAs, fields)) {
                return result;
            }
            const value = this[key];
            result[column.serializeAs] =
                typeof column.serialize === 'function' && !raw ? column.serialize(value, key, this) : value;
            return result;
        }, {});
    }
    /**
     * Serializes model compute properties to an object.
     */
    serializeComputed(fields) {
        const Model = this.constructor;
        const result = {};
        Model.$computedDefinitions.forEach((value, key) => {
            const computedValue = this[key];
            if (computedValue !== undefined && this.shouldSerializeField(value.serializeAs, fields)) {
                result[value.serializeAs] = computedValue;
            }
        });
        return result;
    }
    /**
     * Serializes relationships to a plain object. When `raw=true`, it will
     * recursively serialize the relationships as well.
     */
    serializeRelations(cherryPick, raw = false) {
        const Model = this.constructor;
        return Object.keys(this.$preloaded).reduce((result, key) => {
            const relation = Model.$getRelation(key);
            /**
             * Do not serialize relationship, when serializeAs is null
             */
            if (!relation.serializeAs) {
                return result;
            }
            const value = this.$preloaded[key];
            /**
             * Return relationship model as it is, when `raw` is true.
             */
            if (raw) {
                result[relation.serializeAs] = value;
                return result;
            }
            /**
             * Always make sure we are passing a valid object or undefined
             * to the relationships
             */
            const relationOptions = cherryPick ? cherryPick[relation.serializeAs] : undefined;
            result[relation.serializeAs] = Array.isArray(value)
                ? value.map((one) => one.serialize(relationOptions))
                : value === null
                    ? null
                    : value.serialize(relationOptions);
            return result;
        }, {});
    }
    /**
     * Converting model to it's JSON representation
     */
    serialize(cherryPick) {
        let extras = null;
        if (this.serializeExtras === true) {
            extras = { meta: this.$extras };
        }
        else if (typeof this.serializeExtras === 'function') {
            extras = this.serializeExtras();
        }
        return {
            ...this.serializeAttributes(cherryPick?.fields, false),
            ...this.serializeRelations(cherryPick?.relations, false),
            ...this.serializeComputed(cherryPick?.fields),
            ...extras,
        };
    }
    /**
     * Convert model to a plain Javascript object
     */
    toObject() {
        const Model = this.constructor;
        const computed = {};
        /**
         * Relationships toObject
         */
        const preloaded = Object.keys(this.$preloaded).reduce((result, key) => {
            const value = this.$preloaded[key];
            result[key] = Array.isArray(value) ? value.map((one) => one.toObject()) : value.toObject();
            return result;
        }, {});
        /**
         * Update computed object with computed definitions
         */
        Model.$computedDefinitions.forEach((_, key) => {
            const computedValue = this[key];
            if (computedValue !== undefined) {
                computed[key] = computedValue;
            }
        });
        return {
            ...this.$attributes,
            ...preloaded,
            ...computed,
            $extras: this.$extras,
        };
    }
    /**
     * Returns the serialize method output. However, any model can overwrite
     * it to define it's custom serialize output
     */
    toJSON() {
        return this.serialize();
    }
    /**
     * Returns the query for `insert`, `update` or `delete` actions.
     * Since the query builder for these actions are not exposed to
     * the end user, this method gives a way to compose queries.
     */
    $getQueryFor(action, client) {
        const modelConstructor = this.constructor;
        const primaryKey = modelConstructor.primaryKey;
        const primaryKeyColumn = modelConstructor.$keys.attributesToColumns.get(primaryKey, primaryKey);
        /**
         * Returning insert query for the inserts
         */
        if (action === 'insert') {
            const insertQuery = client.insertQuery().table(modelConstructor.table);
            insertQuery.returning(primaryKeyColumn);
            return insertQuery;
        }
        /**
         * When self assigning the primary key, then we read the primary
         * value from the originals and the attributes, since we allow
         * updating primary key itself
         */
        const primaryKeyValue = modelConstructor.selfAssignPrimaryKey
            ? this.$original[primaryKey]
            : this.$primaryKeyValue;
        /**
         * Returning generic query builder for rest of the queries
         */
        return client.modelQuery(modelConstructor).where(primaryKeyColumn, primaryKeyValue);
    }
    /**
     * Returns an instance of relationship on the given model
     */
    related(relationName) {
        const Model = this.constructor;
        const relation = Model.$getRelation(relationName);
        ensureRelation(relationName, relation);
        relation.boot();
        return relation.client(this, Model.$adapter.modelClient(this));
    }
    /**
     * Reload/Refresh the model instance
     */
    async refresh() {
        this.ensureIsntDeleted();
        /**
         * Noop when model instance is not persisted
         */
        if (!this.$isPersisted) {
            return this;
        }
        const Model = this.constructor;
        await Model.$adapter.refresh(this);
        return this;
    }
};
BaseModelImpl = __decorate([
    StaticImplements()
], BaseModelImpl);
export const BaseModel = BaseModelImpl;
/**
 * Helper to mark a function as query scope
 */
export function scope(callback) {
    return callback;
}
