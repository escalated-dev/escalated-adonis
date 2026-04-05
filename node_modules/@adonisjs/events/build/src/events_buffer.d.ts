import type { AllowedEventTypes, BufferedEvent, BufferedEventsList, Constructor } from './types.js';
/**
 * Callback function to narrow down an event from
 * the events buffer list
 */
type EventFinderCallback<EventsList extends Record<string | symbol | number, any>, Event extends keyof EventsList | Constructor> = (event: Event extends keyof EventsList ? BufferedEvent<Event, EventsList[Event]> : Event extends Constructor<infer A> ? BufferedEvent<Event, A> : never) => boolean;
/**
 * Exposes API to filter, find events from the events buffer.
 */
export declare class EventsBuffer<EventsList extends Record<string | symbol | number, any>> {
    #private;
    /**
     * Track emitted event
     */
    add<Name extends AllowedEventTypes>(event: Name, data: any): void;
    /**
     * Get all the emitted events
     */
    all(): BufferedEventsList<EventsList>[];
    /**
     * Returns the size of captured events
     */
    size(): number;
    /**
     * Find if an event was emitted
     */
    exists<Event extends keyof EventsList | Constructor>(event: Event, finder?: EventFinderCallback<EventsList, Event>): boolean;
    /**
     * Find a specific event
     */
    find<Event extends keyof EventsList | Constructor>(event: Event, finder?: EventFinderCallback<EventsList, Event>): (Event extends keyof EventsList ? BufferedEvent<Event, EventsList[Event]> : Event extends Constructor<infer A> ? BufferedEvent<Event, A> : never) | null;
    /**
     * Assert a given event has been emitted
     */
    assertEmitted<Event extends keyof EventsList | Constructor>(event: Event, finder?: EventFinderCallback<EventsList, Event>): void;
    /**
     * Assert number of times an event has been emitted
     */
    assertEmittedCount<Event extends keyof EventsList | Constructor>(event: Event, count: number): void;
    /**
     * Assert a given event has been not been emitted
     */
    assertNotEmitted<Event extends keyof EventsList | Constructor<any>>(event: Event, finder?: EventFinderCallback<EventsList, Event>): void;
    /**
     * Assert a given event has been not been emitted
     */
    assertNoneEmitted(): void;
    /**
     * Flush events collected within memory
     */
    flush(): void;
}
export {};
