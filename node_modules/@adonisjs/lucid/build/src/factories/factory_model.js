/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import Hooks from '@poppinss/hooks';
import { HasOne } from './relations/has_one.js';
import { HasMany } from './relations/has_many.js';
import { FactoryBuilder } from './factory_builder.js';
import { BelongsTo } from './relations/belongs_to.js';
import { ManyToMany } from './relations/many_to_many.js';
/**
 * Factory model exposes the API to define a model factory with custom
 * states and relationships
 */
export class FactoryModel {
    model;
    define;
    manager;
    /**
     * Method to instantiate a new model instance. This method can be
     * overridden using the `newUp` public method.
     */
    newUpModelInstance = (attributes, _, model) => {
        /**
         * Handling case, where someone returns model instance directly
         */
        if (attributes instanceof model) {
            return attributes;
        }
        const modelInstance = new model();
        modelInstance.merge(attributes);
        return modelInstance;
    };
    /**
     * Method to merge runtime attributes with the model instance. This method
     * can be overridden using the `merge` method.
     */
    mergeAttributes = (model, attributes) => {
        model.merge(attributes);
    };
    /**
     * A collection of factory states
     */
    states = {};
    /**
     * A collection of factory relations
     */
    relations = {};
    /**
     * A set of registered hooks
     */
    hooks = new Hooks();
    constructor(model, define, manager) {
        this.model = model;
        this.define = define;
        this.manager = manager;
    }
    /**
     * Register a before event hook
     */
    before(event, handler) {
        this.hooks.add(`before:${event}`, handler);
        return this;
    }
    /**
     * Register an after event hook
     */
    after(event, handler) {
        this.hooks.add(`after:${event}`, handler);
        return this;
    }
    /**
     * Returns state callback defined on the model factory. Raises an
     * exception, when state is not registered
     */
    getState(state) {
        const stateCallback = this.states[state];
        if (!stateCallback) {
            throw new Error(`Cannot apply undefined state "${state}". Double check the model factory`);
        }
        return stateCallback;
    }
    /**
     * Returns the pre-registered relationship factory function, along with
     * the original model relation.
     */
    getRelation(relation) {
        const relationship = this.relations[relation];
        if (!relationship) {
            throw new Error(`Cannot reference "${String(relation)}" relationship. Make sure to setup the relationship within the factory`);
        }
        return relationship;
    }
    /**
     * Define custom state for the factory. When executing the factory,
     * you can apply the pre-defined states
     */
    state(state, callback) {
        this.states[state] = callback;
        return this;
    }
    /**
     * Define a relationship on another factory
     */
    relation(relation, callback) {
        const modelRelation = this.model.$getRelation(relation);
        /**
         * Only whitelisted relationships are allowed on the factory
         */
        if (!modelRelation) {
            throw new Error([
                `Cannot define "${String(relation)}" relationship.`,
                `The relationship must exist on the "${this.model.name}" model first`,
            ].join(' '));
        }
        switch (modelRelation.type) {
            case 'belongsTo':
                this.relations[relation] = new BelongsTo(modelRelation, callback);
                break;
            case 'hasOne':
                this.relations[relation] = new HasOne(modelRelation, callback);
                break;
            case 'hasMany':
                this.relations[relation] = new HasMany(modelRelation, callback);
                break;
            case 'manyToMany':
                this.relations[relation] = new ManyToMany(modelRelation, callback);
                break;
            case 'hasManyThrough':
                throw new Error([
                    `Cannot define "${String(relation)}" relationship.`,
                    '"hasManyThrough" relationship does not have any persistance API',
                ].join(' '));
        }
        return this;
    }
    /**
     * Define a custom `newUp` method
     */
    newUp(callback) {
        this.newUpModelInstance = callback;
        return this;
    }
    /**
     * Define a custom `merge` method
     */
    merge(callback) {
        this.mergeAttributes = callback;
        return this;
    }
    /**
     * Build factory model and return factory builder. The builder is then
     * used to make/create model instances
     */
    build() {
        /**
         * Return a build object, which proxies all of the factory builder
         * method and invokes them with a fresh instance.
         */
        const builder = {
            factory: this,
            query(options, viaRelation) {
                return new FactoryBuilder(this.factory, options, viaRelation);
            },
            tap(callback) {
                return this.query().tap(callback);
            },
            client(...args) {
                return this.query().client(...args);
            },
            connection(...args) {
                return this.query().connection(...args);
            },
            apply(...args) {
                return this.query().apply(...args);
            },
            with(relation, ...args) {
                return this.query().with(relation, ...args);
            },
            merge(attributes) {
                return this.query().merge(attributes);
            },
            mergeRecursive(attributes) {
                return this.query().mergeRecursive(attributes);
            },
            useCtx(ctx) {
                return this.query().useCtx(ctx);
            },
            make() {
                return this.query().make();
            },
            makeStubbed() {
                return this.query().makeStubbed();
            },
            create() {
                return this.query().create();
            },
            makeMany(count) {
                return this.query().makeMany(count);
            },
            makeStubbedMany(count) {
                return this.query().makeStubbedMany(count);
            },
            createMany(count) {
                return this.query().createMany(count);
            },
            pivotAttributes(attributes) {
                return this.query().pivotAttributes(attributes);
            },
        };
        return builder;
    }
}
