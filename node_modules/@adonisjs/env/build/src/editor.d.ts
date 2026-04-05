export declare class EnvEditor {
    #private;
    /**
     * Creates an instance of env editor and loads .env files
     * contents.
     */
    static create(appRoot: URL): Promise<EnvEditor>;
    constructor(appRoot: URL);
    /**
     * Loads .env files for editing. Only ".env" and ".env.example"
     * files are picked for editing.
     */
    load(): Promise<void>;
    /**
     * Add key-value pair to the dot-env files.
     * If `withEmptyExampleValue` is true then the key will be added with an empty value
     * to the `.env.example` file.
     */
    add(key: string, value: string | number | boolean, withEmptyExampleValue?: boolean): void;
    toJSON(): {
        contents: string[];
        path: string;
    }[];
    /**
     * Save changes to the disk
     */
    save(): Promise<void>;
}
