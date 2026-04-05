import { MqttTransportConfig, TransportEncoder, Transport, Serializable, SubscribeHandler } from '../types/main.js';
import 'ioredis';
import 'mqtt';

/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */

declare function mqtt(config: MqttTransportConfig, encoder?: TransportEncoder): () => MqttTransport;
declare class MqttTransport implements Transport {
    #private;
    constructor(config: MqttTransportConfig, encoder?: TransportEncoder);
    setId(id: string): Transport;
    disconnect(): Promise<void>;
    publish(channel: string, message: any): Promise<void>;
    subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>): Promise<void>;
    onReconnect(): void;
    unsubscribe(channel: string): Promise<void>;
}

export { MqttTransport, mqtt };
