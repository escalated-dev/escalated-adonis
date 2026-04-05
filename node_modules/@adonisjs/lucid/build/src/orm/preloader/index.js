/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import * as errors from '../../errors.js';
/**
 * Exposes the API to define and preload relationships in reference to
 * a model
 */
export class Preloader {
    model;
    preloads = {};
    /**
     * When invoked via query builder. The preloader will get the side-loaded
     * object, that should be transferred to relationship model instances.
     */
    sideloaded = {};
    debugQueries = false;
    constructor(model) {
        this.model = model;
    }
    /**
     * Processes a relationship for a single parent
     */
    async processRelation(name, parent, client) {
        const { relation, callback } = this.preloads[name];
        const query = relation
            .eagerQuery(parent, client)
            .debug(this.debugQueries)
            .sideload(this.sideloaded);
        /**
         * Pass query to end user for adding more constraints
         */
        if (typeof callback === 'function') {
            callback(query);
        }
        const result = await query.selectRelationKeys().exec();
        /**
         * hasOne and belongsTo will always return an array of a single row (if done right)
         */
        if (relation.type === 'hasOne' || relation.type === 'belongsTo') {
            relation.setRelated(parent, result[0] || null);
            return;
        }
        /**
         * Set array of related instances
         */
        relation.setRelated(parent, result);
    }
    /**
     * Process a given relationship for many parent instances. This happens
     * during eager-loading
     */
    async processRelationForMany(name, parent, client) {
        const { relation, callback } = this.preloads[name];
        const query = relation
            .eagerQuery(parent, client)
            .debug(this.debugQueries)
            .sideload(this.sideloaded);
        /**
         * Pass query to end user for adding more constraints
         */
        if (typeof callback === 'function') {
            callback(query);
        }
        const result = await query.selectRelationKeys().exec();
        /**
         * Set array of related instances
         */
        relation.setRelatedForMany(parent, result);
    }
    /**
     * Define a relationship to preload
     */
    load(name, callback) {
        const relation = this.model.$getRelation(name);
        if (!relation) {
            throw new errors.E_UNDEFINED_RELATIONSHIP([name, this.model.name]);
        }
        relation.boot();
        this.preloads[name] = {
            relation: relation,
            callback: callback,
        };
        return this;
    }
    /**
     * Alias for "this.load"
     */
    preload(name, callback) {
        return this.load(name, callback);
    }
    /**
     * Define a relationship to preload, but only if they are not
     * already preloaded
     */
    preloadOnce(name) {
        if (!this.preloads[name]) {
            return this.load(name);
        }
        return this;
    }
    /**
     * Toggle query debugging
     */
    debug(debug) {
        this.debugQueries = debug;
        return this;
    }
    /**
     * Define attributes to be passed to all the model instance as
     * side-loaded attributes
     */
    sideload(values) {
        this.sideloaded = values;
        return this;
    }
    /**
     * Clone preloader instance
     */
    clone() {
        const clone = new Preloader(this.model);
        clone.preloads = Object.assign({}, this.preloads);
        clone.sideloaded = Object.assign({}, this.sideloaded);
        clone.debugQueries = this.debugQueries;
        return clone;
    }
    /**
     * Process of all the preloaded relationships for a single parent
     */
    async processAllForOne(parent, client) {
        await Promise.all(Object.keys(this.preloads).map((relationName) => {
            return this.processRelation(relationName, parent, client);
        }));
    }
    /**
     * Process of all the preloaded relationships for many parents
     */
    async processAllForMany(parent, client) {
        if (!parent.length) {
            return;
        }
        await Promise.all(Object.keys(this.preloads).map((relationName) => {
            return this.processRelationForMany(relationName, parent, client);
        }));
    }
}
