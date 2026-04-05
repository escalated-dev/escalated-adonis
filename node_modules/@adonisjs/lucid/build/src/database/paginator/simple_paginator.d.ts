import { SimplePaginatorContract, SimplePaginatorMetaKeys } from '../../types/querybuilder.js';
/**
 * Simple paginator works with the data set provided by the standard
 * `offset` and `limit` based pagination.
 */
export declare class SimplePaginator extends Array implements SimplePaginatorContract<any> {
    private totalNumber;
    perPage: number;
    currentPage: number;
    private qs;
    private url;
    private rows;
    /**
     * Naming strategy for the pagination meta keys
     */
    static namingStrategy: {
        paginationMetaKeys(): SimplePaginatorMetaKeys;
    };
    /**
     * Can be defined at per instance level as well
     */
    namingStrategy: {
        paginationMetaKeys(): SimplePaginatorMetaKeys;
    };
    /**
     * The first page is always 1
     */
    readonly firstPage: number;
    /**
     * Find if results set is empty or not
     */
    readonly isEmpty: boolean;
    /**
     * Casting `total` to a number. Later, we can think of situations
     * to cast it to a bigint
     */
    readonly total: number;
    /**
     * Find if there are total records or not. This is not same as
     * `isEmpty`.
     *
     * The `isEmpty` reports about the current set of results. However `hasTotal`
     * reports about the total number of records, regardless of the current.
     */
    readonly hasTotal: boolean;
    /**
     * The Last page number
     */
    readonly lastPage: number;
    /**
     * Find if there are more pages to come
     */
    readonly hasMorePages: boolean;
    /**
     * Find if there are enough results to be paginated or not
     */
    readonly hasPages: boolean;
    constructor(totalNumber: number, perPage: number, currentPage: number, ...rows: any[]);
    /**
     * A reference to the result rows
     */
    all(): any[];
    /**
     * Returns JSON meta data
     */
    getMeta(): any;
    /**
     * Returns JSON representation of the paginated
     * data
     */
    toJSON(): {
        meta: any;
        data: any[];
    };
    /**
     * Define query string to be appended to the pagination links
     */
    queryString(values: {
        [key: string]: any;
    }): this;
    /**
     * Define base url for making the pagination links
     */
    baseUrl(url: string): this;
    /**
     * Returns url for a given page. Doesn't validates the integrity of the
     * page
     */
    getUrl(page: number): string;
    /**
     * Returns url for the next page
     */
    getNextPageUrl(): string | null;
    /**
     * Returns URL for the previous page
     */
    getPreviousPageUrl(): string | null;
    /**
     * Returns an array of urls under a given range
     */
    getUrlsForRange(start: number, end: number): {
        url: string;
        page: number;
        isActive: boolean;
    }[];
}
