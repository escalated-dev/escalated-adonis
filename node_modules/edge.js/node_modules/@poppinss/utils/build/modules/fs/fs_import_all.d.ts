export type ImportAllFilesOptions = {
    ignoreMissingRoot?: boolean;
    filter?: (filePath: string, index: number) => boolean;
    sort?: (current: string, next: string) => number;
    transformKeys?: (keys: string[]) => string[];
};
/**
 * Returns an array of file paths from the given location. You can
 * optionally filter and sort files by passing relevant options
 *
 * ```ts
 * await fsReadAll(new URL('./', import.meta.url))
 *
 * await fsReadAll(new URL('./', import.meta.url), {
 *   filter: (filePath) => filePath.endsWith('.js')
 * })

 * await fsReadAll(new URL('./', import.meta.url), {
 *   absolute: true,
 *   unixPaths: true
 * })
* ```
 */
export declare function fsImportAll(location: string | URL, options?: ImportAllFilesOptions): Promise<any>;
