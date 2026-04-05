import { DialectContract } from '../types/database.js';
import { BaseSqliteDialect } from './base_sqlite.js';
export declare class SqliteDialect extends BaseSqliteDialect implements DialectContract {
    readonly name = "sqlite3";
}
