import { type Constructor, type LazyImport } from '@poppinss/utils/types';
/**
 * The "parseBindingReference" method is used to parse binding references
 * similar to route controller binding value or event listener binding value.
 *
 * See the following examples to understand how this function works.
 *
 * ### Magic strings
 * ```ts
 * parseBindingReference('#controllers/home_controller')
 * // returns { moduleNameOrPath: '#controllers/home_controller', method: 'handle' }
 *
 * parseBindingReference('#controllers/home_controller.index')
 * // returns { moduleNameOrPath: '#controllers/home_controller', method: 'index' }
 *
 * parseBindingReference('#controllers/home.controller.index')
 * // returns { moduleNameOrPath: '#controllers/home.controller', method: 'index' }
 * ```
 *
 * ### Class reference
 * ```ts
 * class HomeController {}
 *
 * parseBindingReference([HomeController])
 * // returns { moduleNameOrPath: 'HomeController', method: 'handle' }
 *
 * parseBindingReference([HomeController, 'index'])
 * // returns { moduleNameOrPath: 'HomeController', method: 'index' }
 * ```
 *
 * ### Lazy import reference
 * ```ts
 * const HomeController = () => import('#controllers/home_controller')
 *
 * parseBindingReference([HomeController])
 * // returns { moduleNameOrPath: '#controllers/home_controller', method: 'handle' }
 *
 * parseBindingReference([HomeController, 'index'])
 * // returns { moduleNameOrPath: 'controllers/home_controller', method: 'index' }
 * ```
 */
export declare function parseBindingReference(binding: string | [LazyImport<Constructor<any>> | Constructor<any>, any?]): Promise<{
    moduleNameOrPath: string;
    method: string;
}>;
