import type { HttpContext } from '../../http_context/main.js';
/**
 * Writes the response to the socket. The "finish" method can
 * raise error when unable to serialize the response.
 */
export declare function writeResponse(ctx: HttpContext): () => void;
