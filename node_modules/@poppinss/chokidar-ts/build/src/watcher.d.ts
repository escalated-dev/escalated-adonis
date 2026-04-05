import Emittery from 'emittery';
import tsStatic from 'typescript';
import { type ChokidarOptions } from 'chokidar';
import type { WatcherEvents } from './types.js';
/**
 * Exposes the API to build the typescript project and then watch it
 * for changes.
 */
export declare class Watcher extends Emittery<WatcherEvents & {
    'watcher:ready': undefined;
}> {
    #private;
    constructor(cwd: string, config: tsStatic.ParsedCommandLine);
    /**
     * Build and watch project for changes
     */
    watch(watchPattern?: string | string[], watcherOptions?: ChokidarOptions): import("chokidar").FSWatcher;
}
