import { AsyncLocalStorage } from 'node:async_hooks';
import type { HttpContext } from './main.js';
/**
 * Async local storage for HTTP context
 */
export declare const asyncLocalStorage: {
    isEnabled: boolean;
    storage: null | AsyncLocalStorage<HttpContext>;
    create(): AsyncLocalStorage<HttpContext>;
    destroy(): void;
};
