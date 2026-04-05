import type tsStatic from 'typescript';
import { Watcher } from '@poppinss/chokidar-ts';
import type { RunOptions, WatchOptions } from './types.js';
/**
 * Parses tsconfig.json and prints errors using typescript compiler
 * host
 */
export declare function parseConfig(cwd: string | URL, ts: typeof tsStatic): tsStatic.ParsedCommandLine | undefined;
/**
 * Runs a Node.js script as a child process and inherits the stdio streams
 */
export declare function runNode(cwd: string | URL, options: RunOptions): import("execa").ResultPromise<{
    nodeOptions: string[];
    preferLocal: true;
    windowsHide: false;
    localDir: string | URL;
    cwd: string | URL;
    reject: boolean;
    buffer: false;
    stdio: "pipe" | "inherit";
    env: {
        TZ?: string;
        FORCE_COLOR?: string | undefined;
    };
}>;
/**
 * Runs a script as a child process and inherits the stdio streams
 */
export declare function run(cwd: string | URL, options: Omit<RunOptions, 'nodeArgs'>): import("execa").ResultPromise<{
    preferLocal: true;
    windowsHide: false;
    localDir: string | URL;
    cwd: string | URL;
    buffer: false;
    stdio: "pipe" | "inherit";
    env: {
        TZ?: string;
        FORCE_COLOR?: string | undefined;
    };
}>;
/**
 * Watches the file system using tsconfig file
 */
export declare function watch(cwd: string | URL, ts: typeof tsStatic, options: WatchOptions): {
    watcher: Watcher;
    chokidar: import("chokidar").FSWatcher;
} | undefined;
/**
 * Check if file is an .env file
 */
export declare function isDotEnvFile(filePath: string): boolean;
/**
 * Returns the port to use after inspect the dot-env files inside
 * a given directory.
 *
 * A random port is used when the specified port is in use. Following
 * is the logic for finding a specified port.
 *
 * - The "process.env.PORT" value is used if exists.
 * - The dot-env files are loaded using the "EnvLoader" and the PORT
 *   value is used by iterating over all the loaded files. The
 *   iteration stops after first find.
 */
export declare function getPort(cwd: URL): Promise<number>;
/**
 * Helper function to copy files from relative paths or glob
 * patterns
 */
export declare function copyFiles(files: string[], cwd: string, outDir: string): Promise<void[]>;
