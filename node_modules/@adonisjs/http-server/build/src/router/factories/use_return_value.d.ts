import type { HttpContext } from '../../http_context/main.js';
/**
 * A factory function that uses the return value of the request
 * pipeline as the response
 */
export declare function useReturnValue(ctx: HttpContext): (value: any) => void;
