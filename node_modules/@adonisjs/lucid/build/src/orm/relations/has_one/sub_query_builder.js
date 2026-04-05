/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { BaseSubQueryBuilder } from '../base/sub_query_builder.js';
export class HasOneSubQueryBuilder extends BaseSubQueryBuilder {
    relation;
    appliedConstraints = false;
    constructor(builder, client, relation) {
        super(builder, client, relation, (userFn) => {
            return ($builder) => {
                const subQuery = new HasOneSubQueryBuilder($builder, this.client, this.relation);
                subQuery.isChildQuery = true;
                userFn(subQuery);
                subQuery.applyWhere();
            };
        });
        this.relation = relation;
    }
    /**
     * The keys for constructing the join query
     */
    getRelationKeys() {
        return [this.relation.foreignKey];
    }
    /**
     * Clones the current query
     */
    clone() {
        const clonedQuery = new HasOneSubQueryBuilder(this.knexQuery.clone(), this.client, this.relation);
        this.applyQueryFlags(clonedQuery);
        clonedQuery.appliedConstraints = this.appliedConstraints;
        clonedQuery.debug(this.debugQueries);
        clonedQuery.reporterData(this.customReporterData);
        return clonedQuery;
    }
    /**
     * Applies constraint to limit rows to the current relationship
     * only.
     */
    applyConstraints() {
        if (this.appliedConstraints) {
            return;
        }
        this.appliedConstraints = true;
        const relatedTable = this.relation.relatedModel().table;
        const localTable = this.relation.model.table;
        let tablePrefix = relatedTable;
        /**
         * In case of self joins, we must alias the table selection
         */
        if (relatedTable === localTable) {
            this.knexQuery.from(`${relatedTable} as ${this.selfJoinAlias}`);
            tablePrefix = this.selfJoinAlias;
        }
        this.wrapExisting().where(`${localTable}.${this.relation.localKeyColumnName}`, this.client.ref(`${tablePrefix}.${this.relation.foreignKeyColumnName}`));
    }
}
