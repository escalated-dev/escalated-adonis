import type tsStatic from 'typescript';
/**
 * Exposes the API to parse typescript config file using the
 * TypeScript's official compiler.
 */
export declare class ConfigParser {
    #private;
    constructor(cwd: string | URL, configFileName: string, ts: typeof tsStatic);
    /**
     * Parse file. The errors the return back inside the `error` property
     */
    parse(optionsToExtend?: tsStatic.CompilerOptions): {
        error: tsStatic.Diagnostic | null;
        config?: tsStatic.ParsedCommandLine;
    };
}
