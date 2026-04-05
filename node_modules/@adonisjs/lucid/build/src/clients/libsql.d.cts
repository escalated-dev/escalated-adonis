export = LibSQLClient;
declare class LibSQLClient {
    _driver(): typeof import("@libsql/sqlite3");
    get dialect(): string;
    get driverName(): string;
}
