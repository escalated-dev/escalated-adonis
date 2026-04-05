import type { Application } from '@adonisjs/application';
import { type UnsubscribeFunction } from 'emittery';
import { EventsBuffer } from './events_buffer.js';
import type { Listener, LazyImport, EmitterLike, Constructor, ListenerMethod, AllowedEventTypes, ListenerClassWithHandleMethod } from './types.js';
/**
 * Event emitter is built on top of emittery with support class based
 * events and listeners
 */
export declare class Emitter<EventsList extends Record<string | symbol | number, any>> implements EmitterLike<EventsList> {
    #private;
    /**
     * Returns a map of events and their registered listeners. The
     * map key is the event name and the value is another map
     * of listeners.
     *
     * The listeners map key is the original binding listener
     * and the value is a callback function.
     */
    get eventsListeners(): Map<AllowedEventTypes, Map<Listener<any, Constructor<any>>, ListenerMethod<any>>>;
    constructor(app: Application<any>);
    /**
     * Register a global error handler
     */
    onError(callback: (event: keyof EventsList | Constructor<any>, error: any, data: any) => void): this;
    /**
     * Bind multiple listeners to listen for a single event. The listen
     * method is a convenience helper to be used with class based
     * events and listeners.
     */
    listen<Event extends Constructor<any>>(event: Event, listeners: (ListenerClassWithHandleMethod<InstanceType<Event>> | LazyImport<ListenerClassWithHandleMethod<InstanceType<Event>>>)[]): void;
    /**
     * Listen for an event. The method returns the unsubscribe function.
     */
    on<Event extends Constructor, ListenerClass extends Constructor>(event: Event, listener: Listener<InstanceType<Event>, ListenerClass>): UnsubscribeFunction;
    on<Name extends keyof EventsList, ListenerClass extends Constructor>(event: Name, listener: Listener<EventsList[Name], ListenerClass>): UnsubscribeFunction;
    /**
     * Listen for an event only once
     */
    once<Event extends Constructor, ListenerClass extends Constructor>(event: Event, listener: Listener<InstanceType<Event>, ListenerClass>): void;
    once<Name extends keyof EventsList, ListenerClass extends Constructor>(event: Name, listener: Listener<EventsList[Name], ListenerClass>): void;
    /**
     * Attach a listener to listen for all the events. Wildcard listeners
     * can only be defined as inline callbacks.
     */
    onAny(listener: (event: AllowedEventTypes, data: any) => any | Promise<any>): UnsubscribeFunction;
    /**
     * Emit event. The event listeners will be called asynchronously
     * in parallel.
     *
     * You can await this method to wait for events listeners to finish
     */
    emit<Event extends Constructor<any>>(event: Event, data: InstanceType<Event>): Promise<void>;
    emit<Name extends keyof EventsList>(event: Name, data: EventsList[Name]): Promise<void>;
    /**
     * Emit events serially. The event listeners will be called asynchronously
     * in the same sequence as they are registered.
     *
     * You can await this method to wait for events listeners to finish
     */
    emitSerial<Event extends Constructor<any>>(event: Event, data: InstanceType<Event>): Promise<void>;
    emitSerial<Name extends keyof EventsList>(event: Name, data: EventsList[Name]): Promise<void>;
    /**
     * Remove a specific listener for an event
     */
    off(event: keyof EventsList | Constructor<any>, listener: Listener<any, Constructor<any>>): void;
    /**
     * Remove a specific listener listening for all the events
     */
    offAny(listener: (event: keyof EventsList | Constructor<any>, data: any) => any | Promise<any>): this;
    /**
     * Remove a specific listener for an event
     *
     * @alias "off"
     */
    clearListener(event: keyof EventsList | Constructor<any>, listener: Listener<any, Constructor<any>>): void;
    /**
     * Clear all listeners for a specific event
     */
    clearListeners(event: keyof EventsList | Constructor<any>): void;
    /**
     * Clear all listeners for all the events
     */
    clearAllListeners(): void;
    /**
     * Get count of listeners for a given event or all the events
     */
    listenerCount(event?: keyof EventsList | Constructor<any>): number;
    /**
     * Find if an event has one or more listeners
     */
    hasListeners(event?: keyof EventsList | Constructor<any>): boolean;
    /**
     * Fake one or more events. The listeners for faked events will
     * not be invoked.
     *
     * The return value is an events buffer that collects all the
     * events within memory.
     *
     * Calling this method one than once drops the existing fakes and
     * creates new one.
     */
    fake(events?: (keyof EventsList | Constructor<any>)[]): EventsBuffer<EventsList>;
    /**
     * Restore fakes
     */
    restore(): void;
}
