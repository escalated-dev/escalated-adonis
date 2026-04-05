import { Transport, Serializable, SubscribeHandler } from './types/main.js';
import 'ioredis';
import 'mqtt';

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class ChaosTransport implements Transport {
    #private;
    constructor(innerTransport: Transport);
    setId(id: string): Transport;
    getInnerTransport<T extends Transport>(): T;
    /**
     * Make the cache always throw an error
     */
    alwaysThrow(): this;
    /**
     * Reset the cache to never throw an error
     */
    neverThrow(): this;
    publish(channel: string, message: Serializable): Promise<void>;
    subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    disconnect(): Promise<void>;
    onReconnect(_callback: () => void): void;
}

export { ChaosTransport };
