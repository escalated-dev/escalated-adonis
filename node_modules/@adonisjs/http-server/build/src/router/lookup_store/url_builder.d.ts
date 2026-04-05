import type { Encryption } from '@adonisjs/encryption';
import type { Qs } from '../../qs.js';
import type { RouteFinder } from './route_finder.js';
/**
 * URL builder class is used to create URIs for pre-registered
 * routes.
 *
 * ```ts
 * const builder = new UrlBuilder(encryption, routeFinder)
 *
 * builder
 *  .qs({ sort: 'id' })
 *  .params([category.id])
 *  .make('categories.posts.index')
 * ```
 */
export declare class UrlBuilder {
    #private;
    constructor(encryption: Encryption, routeFinder: RouteFinder, qsParser: Qs);
    /**
     * Prefix a custom base URL to the final URI
     */
    prefixUrl(url: string): this;
    /**
     * Disable route lookup. Calling this method considers
     * the "identifier" as the route pattern
     */
    disableRouteLookup(): this;
    /**
     * Append query string to the final URI
     */
    qs(queryString?: Record<string, any>): this;
    /**
     * Specify params to apply to the route pattern
     */
    params(params?: any[] | Record<string, any>): this;
    /**
     * Generate URL for the given route identifier. The identifier can be the
     * route name, controller.method name or the route pattern
     * itself.
     */
    make(identifier: string): string;
    /**
     * Generate a signed URL for the given route identifier. The identifier can be the
     * route name, controller.method name or the route pattern
     * itself.
     */
    makeSigned(identifier: string, options?: {
        expiresIn?: string | number;
        purpose?: string;
    }): string;
}
