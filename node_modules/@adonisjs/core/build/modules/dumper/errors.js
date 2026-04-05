/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { inspect } from 'node:util';
import { parse } from 'error-stack-parser-es';
import { Exception } from '@poppinss/utils/exception';
/**
 * DumpDie exception is raised by the "dd" function. It will
 * result in dumping the value in response to an HTTP
 * request or printing the value to the console
 */
class DumpDieException extends Exception {
    static status = 500;
    static code = 'E_DUMP_DIE_EXCEPTION';
    #dumper;
    #traceSourceIndex = 1;
    value;
    constructor(value, dumper) {
        super('Dump and Die exception');
        this.#dumper = dumper;
        this.value = value;
    }
    /**
     * Returns the source file and line number location for the error
     */
    #getErrorSource() {
        if (this.fileName && this.lineNumber) {
            return {
                location: this.fileName,
                line: this.lineNumber,
            };
        }
        const source = parse(this)[this.#traceSourceIndex];
        if (!source.fileName || !source.lineNumber) {
            return;
        }
        return {
            location: source.fileName,
            line: source.lineNumber,
        };
    }
    /**
     * Set the index for the trace source. This is helpful when
     * you build nested helpers on top of Die/Dump
     */
    setTraceSourceIndex(index) {
        this.#traceSourceIndex = index;
        return this;
    }
    /**
     * Preventing itself from getting reported by the
     * AdonisJS exception reporter
     */
    report() { }
    /**
     * Handler called by the AdonisJS HTTP exception handler
     */
    async handle(error, ctx) {
        const source = this.#getErrorSource();
        /**
         * Comes from the shield package
         */
        const cspNonce = 'nonce' in ctx.response ? ctx.response.nonce : undefined;
        ctx.response
            .status(500)
            .send('<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width">' +
            `${this.#dumper.getHeadElements(cspNonce)}` +
            '</head>' +
            '<body>' +
            `${this.#dumper.dumpToHtml(error.value, { cspNonce, source, title: 'DUMP DIE' })}` +
            '</body>' +
            '</html>');
    }
    /**
     * Handler called by the AdonisJS Ace kernel
     */
    async render(error, kernel) {
        const source = this.#getErrorSource();
        kernel.ui.logger.log(this.#dumper.dumpToAnsi(error.value, { source, title: 'DUMP DIE' }));
    }
    /**
     * Custom output for the Node.js util inspect
     */
    [inspect.custom]() {
        const source = this.#getErrorSource();
        return this.#dumper.dumpToAnsi(this.value, { source, title: 'DUMP DIE' });
    }
}
export const E_DUMP_DIE_EXCEPTION = DumpDieException;
