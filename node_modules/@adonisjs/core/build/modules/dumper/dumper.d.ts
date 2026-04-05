import type { HTMLDumpConfig } from '@poppinss/dumper/html/types';
import type { ConsoleDumpConfig } from '@poppinss/dumper/console/types';
import type { Application } from '../app.js';
/**
 * Dumper exposes the API to dump or die/dump values in your
 * AdonisJS application. An singleton instance of the Dumper
 * is shared as a service and may use it follows.
 *
 * ```ts
 * const dumper = container.make('dumper')
 *
 * dumper.configureHtmlOutput({
 *   // parser + html formatter config
 * })
 *
 * dumper.configureAnsiOutput({
 *   // parser + console formatter config
 * })
 *
 * const html = dumper.dumpToHtml(value)
 * const ansi = dumper.dumpToAnsi(value)
 *
 * // Returns style and script tags that must be
 * // injeted to the head of the HTML document
 *
 * const head = dumper.getHeadElements()
 * ```
 */
export declare class Dumper {
    #private;
    constructor(app: Application<any>);
    /**
     * Configure the HTML formatter output
     */
    configureHtmlOutput(config: HTMLDumpConfig): this;
    /**
     * Configure the ANSI formatter output
     */
    configureAnsiOutput(config: ConsoleDumpConfig): this;
    /**
     * Returns the style and the script elements for the
     * HTML document
     */
    getHeadElements(cspNonce?: string): string;
    /**
     * Dump value to HTML ouput
     */
    dumpToHtml(value: unknown, options?: {
        cspNonce?: string;
        title?: string;
        source?: {
            location: string;
            line: number;
        };
    }): string;
    /**
     * Dump value to ANSI output
     */
    dumpToAnsi(value: unknown, options?: {
        title?: string;
        source?: {
            location: string;
            line: number;
        };
    }): string;
    /**
     * Dump values and die. The formatter will be picked
     * based upon where your app is running.
     *
     * - During an HTTP request, the HTML output will be
     *   sent to the server.
     * - Otherwise the value will be logged in the console
     */
    dd(value: unknown, traceSourceIndex?: number): void;
}
