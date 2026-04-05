import { Pool } from 'tarn';
import { Knex } from 'knex';
import { EventEmitter } from 'node:events';
import type { Logger } from '@adonisjs/core/logger';
import type { ConnectionConfig, ConnectionContract } from '../types/database.js';
/**
 * Connection class manages a given database connection. Internally it uses
 * knex to build the database connection with appropriate database
 * driver.
 */
export declare class Connection extends EventEmitter implements ConnectionContract {
    name: string;
    config: ConnectionConfig;
    private logger;
    /**
     * Reference to knex. The instance is created once the `open`
     * method is invoked
     */
    client?: Knex;
    /**
     * Read client when read/write replicas are defined in the config, otherwise
     * it is a reference to the `client`.
     */
    readClient?: Knex;
    /**
     * Connection dialect name.
     * @deprecated
     * @see clientName
     */
    dialectName: ConnectionContract['clientName'];
    /**
     * Connection client name.
     */
    clientName: ConnectionContract['clientName'];
    /**
     * A boolean to know if connection operates on read/write
     * replicas
     */
    hasReadWriteReplicas: boolean;
    /**
     * Config for one or more read replicas. Only exists, when replicas are
     * defined
     */
    private readReplicas;
    /**
     * The round robin counter for reading config
     */
    private roundRobinCounter;
    constructor(name: string, config: ConnectionConfig, logger: Logger);
    /**
     * Validates the config to ensure that read/write replicas are defined
     * properly.
     */
    private validateConfig;
    /**
     * Cleans up reference for the write client and also the
     * read client when not using replicas
     */
    private cleanupWriteClient;
    /**
     * Cleans up reference for the read client
     */
    private cleanupReadClient;
    /**
     * Does cleanup by removing knex reference and removing all listeners.
     * For the same of simplicity, we get rid of both read and write
     * clients, when anyone of them disconnects.
     */
    private monitorPoolResources;
    /**
     * Returns normalized config object for write replica to be
     * used by knex
     */
    private getWriteConfig;
    /**
     * Returns the config for read replicas.
     */
    private getReadConfig;
    /**
     * Resolves connection config for the writer connection
     */
    private writeConfigResolver;
    /**
     * Resolves connection config for the reader connection
     */
    private readConfigResolver;
    /**
     * Creates the write connection.
     */
    private setupWriteConnection;
    /**
     * Creates the read connection. If there aren't any replicas in use, then
     * it will use the write client instead.
     */
    private setupReadConnection;
    /**
     * Returns the pool instance for the given connection
     */
    get pool(): null | Pool<any>;
    /**
     * Returns the pool instance for the read connection. When replicas are
     * not in use, then read/write pools are same.
     */
    get readPool(): null | Pool<any>;
    /**
     * Returns a boolean indicating if the connection is ready for making
     * database queries. If not, one must call `connect`.
     */
    get ready(): boolean;
    /**
     * Opens the connection by creating knex instance
     */
    connect(): void;
    /**
     * Closes DB connection by destroying knex instance. The `connection`
     * object must be free for garbage collection.
     *
     * In case of error this method will emit `close:error` event followed
     * by the `close` event.
     */
    disconnect(): Promise<void>;
}
