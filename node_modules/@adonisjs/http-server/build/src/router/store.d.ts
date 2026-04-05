import type { RouteJSON, MatchedRoute, StoreRoutesTree, MatchItRouteToken } from '../types/route.js';
/**
 * Store class is used to store a list of routes, along side with their tokens
 * to match the URLs.
 *
 * ```ts
 * const store = new Store()
 *
 * store.add({
 *  pattern: 'posts/:id',
 *  handler: function onRoute () {},
 *  middleware: [],
 *  matchers: {
 *    id: '^[0-9]$+'
 *  },
 *  meta: {},
 *  methods: ['GET']
 * })
 *
 * store.match('posts/1', 'GET')
 * ```
 */
export declare class RoutesStore {
    #private;
    /**
     * A flag to know if routes for explicit domains
     * have been registered
     */
    usingDomains: boolean;
    /**
     * Tree of registered routes and their matchit tokens
     */
    tree: StoreRoutesTree;
    /**
     * Add a route to the store
     *
     * ```ts
     * store.add({
     *   pattern: 'post/:id',
     *   methods: ['GET'],
     *   matchers: {},
     *   meta: {},
     *   handler: function handler () {
     *   }
     * })
     * ```
     */
    add(route: RouteJSON): this;
    /**
     * Matches the url, method and optionally domain to pull the matching
     * route. `null` is returned when unable to match the URL against
     * registered routes.
     *
     * The domain parameter has to be a registered pattern and not the fully
     * qualified runtime domain. You must call `matchDomain` first to fetch
     * the pattern for qualified domain
     */
    match(url: string, method: string, domain?: {
        tokens: MatchItRouteToken[];
        hostname: string;
    }): null | MatchedRoute;
    /**
     * Match hostname against registered domains.
     */
    matchDomain(hostname?: string | null): MatchItRouteToken[];
}
