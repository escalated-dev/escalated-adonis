"use strict";
/* eslint-disable @typescript-eslint/no-shadow */
/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireRawConnection = void 0;
const stream_1 = __importDefault(require("stream"));
const util_1 = require("util");
const utils_1 = require("knex/lib/dialects/oracledb/utils");
/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L466
 */
const lobProcessing = function (stream) {
    const oracledb = require('oracledb');
    /**
     * @type 'string' | 'buffer'
     */
    let type;
    if (stream.type) {
        // v1.2-v4
        if (stream.type === oracledb.BLOB) {
            type = 'buffer';
        }
        else if (stream.type === oracledb.CLOB) {
            type = 'string';
        }
    }
    else if (stream.iLob) {
        // v1
        if (stream.iLob.type === oracledb.CLOB) {
            type = 'string';
        }
        else if (stream.iLob.type === oracledb.BLOB) {
            type = 'buffer';
        }
    }
    else {
        throw new Error('Unrecognized oracledb lob stream type');
    }
    if (type === 'string') {
        stream.setEncoding('utf-8');
    }
    return readStream(stream, type);
};
/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L424
 */
function resolveConnectString(connectionSettings) {
    if (connectionSettings.connectString) {
        return connectionSettings.connectString;
    }
    if (!connectionSettings.port) {
        return connectionSettings.host + '/' + connectionSettings.database;
    }
    return connectionSettings.host + ':' + connectionSettings.port + '/' + connectionSettings.database;
}
/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L442
 */
function readStream(stream, type) {
    return new Promise((resolve, reject) => {
        let data = type === 'string' ? '' : Buffer.alloc(0);
        stream.on('error', function (err) {
            reject(err);
        });
        stream.on('data', function (chunk) {
            if (type === 'string') {
                data += chunk;
            }
            else {
                data = Buffer.concat([data, chunk]);
            }
        });
        stream.on('end', function () {
            resolve(data);
        });
    });
}
/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
function acquireRawConnection() {
    const client = this;
    const asyncConnection = new Promise(function (resolver, rejecter) {
        const settings = client.getRuntimeConnectionSettings();
        // If external authentication don't have to worry about username/password and
        // if not need to set the username and password
        const oracleDbConfig = settings.externalAuth
            ? { externalAuth: settings.externalAuth }
            : {
                user: settings.user,
                password: settings.password,
            };
        // In the case of external authentication connection string will be given
        oracleDbConfig['connectString'] = resolveConnectString(settings);
        if (settings.prefetchRowCount) {
            oracleDbConfig['prefetchRows'] = settings.prefetchRowCount;
        }
        if (settings.stmtCacheSize !== undefined) {
            oracleDbConfig['stmtCacheSize'] = settings.stmtCacheSize;
        }
        client.driver.fetchAsString = client.fetchAsString;
        client.driver.getConnection(oracleDbConfig, function (err, connection) {
            if (err) {
                return rejecter(err);
            }
            connection.commitAsync = function () {
                return new Promise((commitResolve, commitReject) => {
                    this.commit(function (err) {
                        if (err) {
                            return commitReject(err);
                        }
                        commitResolve();
                    });
                });
            };
            connection.rollbackAsync = function () {
                return new Promise((rollbackResolve, rollbackReject) => {
                    this.rollback(function (err) {
                        if (err) {
                            return rollbackReject(err);
                        }
                        rollbackResolve();
                    });
                });
            };
            const fetchAsync = (0, util_1.promisify)(function (sql, bindParams, options, cb) {
                options = options || {};
                options.outFormat = client.driver.OUT_FORMAT_OBJECT || client.driver.OBJECT;
                if (!options.outFormat) {
                    throw new Error('not found oracledb.outFormat constants');
                }
                if (options.resultSet) {
                    connection.execute(sql, bindParams || [], options, function (err, result) {
                        if (err) {
                            if ((0, utils_1.isConnectionError)(err)) {
                                connection.close().catch(function () { });
                                connection.__knex__disposed = err;
                            }
                            return cb(err);
                        }
                        const fetchResult = { rows: [], resultSet: result.resultSet };
                        const numRows = 100;
                        const fetchRowsFromRS = function (connection, resultSet, numRows) {
                            resultSet.getRows(numRows, function (err, rows) {
                                if (err) {
                                    if ((0, utils_1.isConnectionError)(err)) {
                                        connection.close().catch(function () { });
                                        connection.__knex__disposed = err;
                                    }
                                    resultSet.close(function () {
                                        return cb(err);
                                    });
                                }
                                else if (rows.length === 0) {
                                    return cb(null, fetchResult);
                                }
                                else if (rows.length > 0) {
                                    if (rows.length === numRows) {
                                        fetchResult.rows = fetchResult.rows.concat(rows);
                                        fetchRowsFromRS(connection, resultSet, numRows);
                                    }
                                    else {
                                        fetchResult.rows = fetchResult.rows.concat(rows);
                                        return cb(null, fetchResult);
                                    }
                                }
                            });
                        };
                        fetchRowsFromRS(connection, result.resultSet, numRows);
                    });
                }
                else {
                    connection.execute(sql, bindParams || [], options, function (err, result) {
                        if (err) {
                            // dispose the connection on connection error
                            if ((0, utils_1.isConnectionError)(err)) {
                                connection.close().catch(function () { });
                                connection.__knex__disposed = err;
                            }
                            return cb(err);
                        }
                        return cb(null, result);
                    });
                }
            });
            connection.executeAsync = function (sql, bindParams, options) {
                // Read all lob
                return fetchAsync(sql, bindParams, options).then(async (results) => {
                    const closeResultSet = () => {
                        return results.resultSet
                            ? (0, util_1.promisify)(results.resultSet.close).call(results.resultSet)
                            : Promise.resolve();
                    };
                    // Collect LOBs to read
                    const lobs = [];
                    if (results.rows) {
                        if (Array.isArray(results.rows)) {
                            for (let i = 0; i < results.rows.length; i++) {
                                // Iterate through the rows
                                const row = results.rows[i];
                                for (const column in row) {
                                    if (row[column] instanceof stream_1.default.Readable) {
                                        lobs.push({ index: i, key: column, stream: row[column] });
                                    }
                                }
                            }
                        }
                    }
                    try {
                        for (const lob of lobs) {
                            // todo should be fetchAsString/fetchAsBuffer polyfill only
                            results.rows[lob.index][lob.key] = await lobProcessing(lob.stream);
                        }
                    }
                    catch (e) {
                        await closeResultSet().catch(() => { });
                        throw e;
                    }
                    await closeResultSet();
                    return results;
                });
            };
            resolver(connection);
        });
    });
    return asyncConnection;
}
exports.acquireRawConnection = acquireRawConnection;
