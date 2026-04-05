import type { Emitter } from '@adonisjs/core/events';
import type { Logger } from '@adonisjs/core/logger';
import { ConnectionNode, ConnectionConfig, ConnectionManagerContract } from '../types/database.js';
/**
 * Connection manager job is to manage multiple named connections. You can add any number
 * or connections by registering their config only once and then make use of `connect`
 * and `close` methods to create and destroy db connections.
 */
export declare class ConnectionManager implements ConnectionManagerContract {
    private logger;
    private emitter;
    /**
     * List of managed connections
     */
    connections: ConnectionManagerContract['connections'];
    /**
     * Connections for which the config was patched. They must get removed
     * overtime, unless application is behaving unstable.
     */
    private orphanConnections;
    constructor(logger: Logger, emitter: Emitter<any>);
    /**
     * Handles disconnection of a connection
     */
    private handleDisconnect;
    /**
     * Handles event when a new connection is added
     */
    private handleConnect;
    /**
     * Monitors a given connection by listening for lifecycle events
     */
    private monitorConnection;
    /**
     * Add a named connection with it's configuration. Make sure to call `connect`
     * before using the connection to make database queries.
     */
    add(connectionName: string, config: ConnectionConfig): void;
    /**
     * Connect to the database using config for a given named connection
     */
    connect(connectionName: string): void;
    /**
     * Patching the config
     */
    patch(connectionName: string, config: ConnectionConfig): void;
    /**
     * Returns the connection node for a given named connection
     */
    get(connectionName: string): ConnectionNode | undefined;
    /**
     * Returns a boolean telling if we have connection details for
     * a given named connection. This method doesn't tell if
     * connection is connected or not.
     */
    has(connectionName: string): boolean;
    /**
     * Returns a boolean telling if connection has been established
     * with the database or not
     */
    isConnected(connectionName: string): boolean;
    /**
     * Closes a given connection and can optionally release it from the
     * tracking list
     */
    close(connectionName: string, release?: boolean): Promise<void>;
    /**
     * Close all tracked connections
     */
    closeAll(release?: boolean): Promise<void>;
    /**
     * Release a connection. This will disconnect the connection
     * and will delete it from internal list
     */
    release(connectionName: string): Promise<void>;
}
