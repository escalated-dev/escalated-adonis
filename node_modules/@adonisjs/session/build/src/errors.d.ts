/**
 * Raised when session store is not mutable
 */
export declare const E_SESSION_NOT_MUTABLE: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * Raised when session store has been initiated
 */
export declare const E_SESSION_NOT_READY: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * Raised when trying to use tagging with a store that
 * doesn't support tagging operations
 */
export declare const E_SESSION_TAGGING_NOT_SUPPORTED: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
