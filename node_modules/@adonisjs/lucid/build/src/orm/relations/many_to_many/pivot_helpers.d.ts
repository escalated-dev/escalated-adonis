import { ManyToManyQueryBuilder } from './query_builder.js';
import { ManyToManySubQueryBuilder } from './sub_query_builder.js';
export declare class PivotHelpers {
    private query;
    private aliasSelectColumns;
    constructor(query: ManyToManyQueryBuilder | ManyToManySubQueryBuilder, aliasSelectColumns: boolean);
    /**
     * Prefixes the pivot table name to a column
     */
    prefixPivotTable(column: string): string;
    /**
     * Adds a where pivot condition to the query
     */
    wherePivot(variation: 'or' | 'and' | 'not' | 'orNot', key: any, operator?: any, value?: any): ManyToManySubQueryBuilder | ManyToManyQueryBuilder;
    /**
     * Adds a where pivot condition to the query
     */
    whereNullPivot(variation: 'or' | 'and' | 'not' | 'orNot', key: string): any;
    /**
     * Adds a where pivot condition to the query
     */
    whereInPivot(variation: 'or' | 'and' | 'not' | 'orNot', key: any, value: any): ManyToManySubQueryBuilder | ManyToManyQueryBuilder;
    /**
     * Select pivot columns
     */
    pivotColumns(columns: string[]): this;
}
