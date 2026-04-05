/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { sourceFiles } from '../utils/index.js';
/**
 * Seeders source exposes the API to read the seeders from disk for a given connection.
 */
export class SeedersSource {
    config;
    app;
    constructor(config, app) {
        this.config = config;
        this.app = app;
    }
    /**
     * Returns an array of files inside a given directory. Relative
     * paths are resolved from the project root
     */
    async getDirectoryFiles(directoryPath) {
        const { files } = await sourceFiles(this.app.appRoot, directoryPath, this.config.seeders?.naturalSort || false);
        return files;
    }
    /**
     * Returns an array of seeders paths for a given connection. If paths
     * are not defined, then `database/seeders` fallback is used
     */
    getSeedersPaths() {
        const directories = (this.config.seeders || {}).paths;
        const defaultDirectory = this.app.relativePath(this.app.seedersPath()) || 'database/seeders';
        return directories && directories.length ? directories : [`./${defaultDirectory}`];
    }
    /**
     * Returns an array of files for the defined seed directories
     */
    async getSeeders() {
        const seedersPaths = this.getSeedersPaths();
        const directories = await Promise.all(seedersPaths.map((directoryPath) => {
            return this.getDirectoryFiles(directoryPath);
        }));
        return directories.reduce((result, directory) => {
            result = result.concat(directory);
            return result;
        }, []);
    }
}
