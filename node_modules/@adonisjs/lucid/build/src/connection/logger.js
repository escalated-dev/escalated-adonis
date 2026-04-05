/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Custom knex logger that uses adonisjs logger under the
 * hood.
 */
export class Logger {
    name;
    adonisLogger;
    warn = function (message) {
        this.adonisLogger.warn(message);
    }.bind(this);
    error = function (message) {
        this.adonisLogger.error(message);
    }.bind(this);
    deprecate = function (message) {
        this.adonisLogger.info(message);
    }.bind(this);
    debug = function (message) {
        this.warn('"debug" property inside config is depreciated. We recommend using "db:query" event for enrich logging');
        this.adonisLogger.debug(message);
    }.bind(this);
    constructor(name, adonisLogger) {
        this.name = name;
        this.adonisLogger = adonisLogger;
    }
}
