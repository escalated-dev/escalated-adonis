import { RetryQueueOptions, TransportMessage, Transport, Serializable, SubscribeHandler, TransportConfig, ManagerConfig } from './src/types/main.js';
import 'ioredis';
import 'mqtt';

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class RetryQueueWithDuplicates {
    #private;
    constructor(params?: RetryQueueOptions);
    size(): number;
    process(handler: (channel: string, message: TransportMessage) => Promise<boolean>): Promise<void>;
    enqueue(channel: string, message: TransportMessage): boolean;
    dequeue(): TransportMessage<any> | undefined;
}

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class RetryQueueWithoutDuplicates {
    #private;
    constructor(params?: RetryQueueOptions);
    size(): number;
    process(handler: (channel: string, message: TransportMessage) => Promise<boolean>): Promise<void>;
    enqueue(channel: string, message: TransportMessage): boolean;
    dequeue(): any;
}

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class RetryQueue {
    #private;
    constructor(params?: RetryQueueOptions);
    getOptions(): RetryQueueOptions;
    getInternalQueue(): RetryQueueWithDuplicates | RetryQueueWithoutDuplicates;
    size(): number;
    process(handler: (channel: string, message: TransportMessage) => Promise<boolean>): Promise<void>;
    enqueue(channel: string, message: TransportMessage): boolean;
    dequeue(): void;
}

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class Bus {
    #private;
    constructor(transport: Transport, options?: {
        retryQueue?: RetryQueueOptions;
    });
    getRetryQueue(): RetryQueue;
    processErrorRetryQueue(): Promise<void>;
    subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>): Promise<void>;
    publish(channel: string, message: Serializable): Promise<boolean>;
    disconnect(): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
}

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare class BusManager<KnownTransports extends Record<string, TransportConfig>> {
    #private;
    constructor(config: ManagerConfig<KnownTransports>);
    use<KnownTransport extends keyof KnownTransports>(transports?: KnownTransport): Bus;
    publish(channel: string, message: Serializable): Promise<boolean>;
    subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    disconnect(): Promise<void>;
}

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare function defineConfig<KnownTransports extends Record<string, TransportConfig>>(config: ManagerConfig<KnownTransports>): ManagerConfig<KnownTransports>;

export { Bus, BusManager, defineConfig };
