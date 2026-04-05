/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Used for reporting queries using the profiler and the event
 * emitter
 */
export class QueryReporter {
    client;
    debug;
    data;
    eventName = 'db:query';
    startTime;
    isReady = false;
    constructor(client, debug, data) {
        this.client = client;
        this.debug = debug;
        this.data = data;
    }
    /**
     * Initiate the hrtime when there are one or more query listeners
     */
    initStartTime() {
        if (!this.client.emitter.hasListeners(this.eventName) || !this.debug) {
            return;
        }
        this.startTime = process.hrtime();
    }
    /**
     * Emit the query with duration
     */
    emitQueryEvent(error) {
        if (!this.startTime) {
            return;
        }
        const eventData = { duration: process.hrtime(this.startTime), ...this.data, error };
        this.client.emitter.emit(this.eventName, eventData);
    }
    /**
     * Begin query reporting. Data passed to this method will
     * overwrite the existing data object
     */
    begin(data) {
        this.isReady = true;
        this.data = data || this.data;
        this.initStartTime();
        return this;
    }
    /**
     * End query reporting
     */
    end(error) {
        if (!this.isReady) {
            return;
        }
        this.emitQueryEvent(error);
    }
}
