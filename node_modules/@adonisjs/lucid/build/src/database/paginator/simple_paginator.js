/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { stringify } from 'qs';
import { CamelCaseNamingStrategy } from '../../orm/naming_strategies/camel_case.js';
/**
 * Simple paginator works with the data set provided by the standard
 * `offset` and `limit` based pagination.
 */
export class SimplePaginator extends Array {
    totalNumber;
    perPage;
    currentPage;
    qs = {};
    url = '/';
    rows;
    /**
     * Naming strategy for the pagination meta keys
     */
    static namingStrategy = new CamelCaseNamingStrategy();
    /**
     * Can be defined at per instance level as well
     */
    namingStrategy = SimplePaginator.namingStrategy;
    /**
     * The first page is always 1
     */
    firstPage = 1;
    /**
     * Find if results set is empty or not
     */
    isEmpty;
    /**
     * Casting `total` to a number. Later, we can think of situations
     * to cast it to a bigint
     */
    total;
    /**
     * Find if there are total records or not. This is not same as
     * `isEmpty`.
     *
     * The `isEmpty` reports about the current set of results. However `hasTotal`
     * reports about the total number of records, regardless of the current.
     */
    hasTotal;
    /**
     * The Last page number
     */
    lastPage;
    /**
     * Find if there are more pages to come
     */
    hasMorePages;
    /**
     * Find if there are enough results to be paginated or not
     */
    hasPages;
    constructor(totalNumber, perPage, currentPage, ...rows) {
        super(...rows);
        this.totalNumber = totalNumber;
        this.perPage = perPage;
        this.currentPage = currentPage;
        this.rows = rows;
        this.isEmpty = this.rows.length === 0;
        this.total = Number(this.totalNumber);
        this.hasTotal = this.total > 0;
        this.lastPage = Math.max(Math.ceil(this.total / this.perPage), 1);
        this.hasPages = this.lastPage !== 1;
        this.hasMorePages = this.lastPage > this.currentPage;
    }
    /**
     * A reference to the result rows
     */
    all() {
        return this.rows;
    }
    /**
     * Returns JSON meta data
     */
    getMeta() {
        const metaKeys = this.namingStrategy.paginationMetaKeys();
        return {
            [metaKeys.total]: this.total,
            [metaKeys.perPage]: this.perPage,
            [metaKeys.currentPage]: this.currentPage,
            [metaKeys.lastPage]: this.lastPage,
            [metaKeys.firstPage]: this.firstPage,
            [metaKeys.firstPageUrl]: this.getUrl(1),
            [metaKeys.lastPageUrl]: this.getUrl(this.lastPage),
            [metaKeys.nextPageUrl]: this.getNextPageUrl(),
            [metaKeys.previousPageUrl]: this.getPreviousPageUrl(),
        };
    }
    /**
     * Returns JSON representation of the paginated
     * data
     */
    toJSON() {
        return {
            meta: this.getMeta(),
            data: this.all(),
        };
    }
    /**
     * Define query string to be appended to the pagination links
     */
    queryString(values) {
        this.qs = values;
        return this;
    }
    /**
     * Define base url for making the pagination links
     */
    baseUrl(url) {
        this.url = url;
        return this;
    }
    /**
     * Returns url for a given page. Doesn't validates the integrity of the
     * page
     */
    getUrl(page) {
        const qs = stringify(Object.assign({}, this.qs, { page: page < 1 ? 1 : page }));
        return `${this.url}?${qs}`;
    }
    /**
     * Returns url for the next page
     */
    getNextPageUrl() {
        if (this.hasMorePages) {
            return this.getUrl(this.currentPage + 1);
        }
        return null;
    }
    /**
     * Returns URL for the previous page
     */
    getPreviousPageUrl() {
        if (this.currentPage > 1) {
            return this.getUrl(this.currentPage - 1);
        }
        return null;
    }
    /**
     * Returns an array of urls under a given range
     */
    getUrlsForRange(start, end) {
        let urls = [];
        for (let i = start; i <= end; i++) {
            urls.push({ url: this.getUrl(i), page: i, isActive: i === this.currentPage });
        }
        return urls;
    }
}
