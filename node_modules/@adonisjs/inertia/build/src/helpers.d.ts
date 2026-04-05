/**
 * Utility function to resolve a page component
 *
 * @example
 *    return resolvePageComponent(
 *      `./pages/${name}.vue`,
 *       import.meta.glob<DefineComponent>("./pages/**\/*.vue")
 *    )
 */
declare function resolvePageComponent<T>(path: string | string[], pages: Record<string, Promise<T> | (() => Promise<T>)>): Promise<T>;

export { resolvePageComponent };
