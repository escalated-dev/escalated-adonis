/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { SeedersSource } from './source.js';
/**
 * Seeds Runner exposes the API to traverse seeders and execute them
 * in bulk
 */
export class SeedsRunner {
    db;
    app;
    connectionName;
    client;
    config;
    nodeEnvironment;
    constructor(db, app, connectionName) {
        this.db = db;
        this.app = app;
        this.connectionName = connectionName;
        this.client = this.db.connection(this.connectionName || this.db.primaryConnectionName);
        this.config = this.db.getRawConnection(this.client.connectionName).config;
        this.nodeEnvironment = this.app.nodeEnvironment;
    }
    /**
     * Returns the seeder source by ensuring value is a class constructor
     */
    async getSeederSource(file) {
        const source = await file.getSource();
        if (typeof source === 'function') {
            return source;
        }
        throw new Error(`Invalid schema class exported by "${file.name}"`);
    }
    /**
     * Returns an array of seeders
     */
    async getList() {
        return new SeedersSource(this.config, this.app).getSeeders();
    }
    /**
     * Executes the seeder
     */
    async run(file) {
        const Source = await this.getSeederSource(file);
        const seeder = {
            status: 'pending',
            file: file,
        };
        /**
         * Ignore when the node environment is not the same as the seeder configuration.
         */
        if (Source.environment && !Source.environment.includes(this.nodeEnvironment)) {
            seeder.status = 'ignored';
            return seeder;
        }
        try {
            const seederInstance = new Source(this.client);
            if (typeof seederInstance.run !== 'function') {
                throw new Error(`Missing method "run" on "${seeder.file.name}" seeder`);
            }
            await seederInstance.run();
            seeder.status = 'completed';
        }
        catch (error) {
            seeder.status = 'failed';
            seeder.error = error;
        }
        return seeder;
    }
    /**
     * Close database connections
     */
    async close() {
        await this.db.manager.closeAll(true);
    }
}
