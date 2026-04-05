/**
 * The exception is raised when the "pattern" property is missing
 * in the meta file object.
 */
export declare const E_MISSING_METAFILE_PATTERN: new (args: [fileProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "file" property is missing
 * in the preload file object
 */
export declare const E_MISSING_PRELOAD_FILE: new (args: [preloadProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "file" property is not a function
 */
export declare const E_INVALID_PRELOAD_FILE: new (args: [preloadProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "file" property is missing
 * in the provider object
 */
export declare const E_MISSING_PROVIDER_FILE: new (args: [preloadProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "file" property is not a function
 * in provider object
 */
export declare const E_INVALID_PROVIDER: new (args: [preloadProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "name" property is missing
 * in the suite object
 */
export declare const E_MISSING_SUITE_NAME: new (args: [suiteProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "files" property is missing
 * in the suite object
 */
export declare const E_MISSING_SUITE_FILES: new (args: [suiteProperty: string], options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "devServerCommand" is missing
 * in assetsBundler object
 */
export declare const E_MISSING_BUNDLER_DEV_COMMAND: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "buildCommand" is missing
 * in assetsBundler object
 */
export declare const E_MISSING_BUNDLER_BUILD_COMMAND: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "name" is missing
 * in assetsBundler object
 */
export declare const E_MISSING_BUNDLER_NAME: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "name" is missing
 * in assembler.runner object
 */
export declare const E_MISSING_ASSEMBLER_RUNNER_NAME: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
/**
 * The exception is raised when the "command" is missing
 * in assembler.runner object
 */
export declare const E_MISSING_ASSEMBLER_RUNNER_COMMAND: new (args?: any, options?: ErrorOptions) => import("@poppinss/utils").Exception;
