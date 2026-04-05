import { DialectContract } from '../types/database.js';
import { BaseSqliteDialect } from './base_sqlite.js';
export declare class BetterSqliteDialect extends BaseSqliteDialect implements DialectContract {
    readonly name = "better-sqlite3";
}
