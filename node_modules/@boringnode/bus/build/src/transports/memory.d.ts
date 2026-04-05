import { Transport, Serializable, SubscribeHandler } from '../types/main.js';
import 'ioredis';
import 'mqtt';

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare function memory(): () => MemoryTransport;
declare class MemoryTransport implements Transport {
    #private;
    setId(id: string): this;
    /**
     * List of messages received by this bus
     */
    receivedMessages: any[];
    publish(channel: string, message: Serializable): Promise<void>;
    subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    disconnect(): Promise<void>;
    onReconnect(_callback: () => void): void;
}

export { MemoryTransport, memory };
