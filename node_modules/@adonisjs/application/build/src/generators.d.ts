/**
 * Generators used for scaffolding
 */
declare const generators: {
    /**
     * The given controller names will always be generated
     * in singular form
     */
    singularControllerNames: string[];
    /**
     * Creates the entity path and name from the user
     * input.
     */
    createEntity(entityName: string): {
        path: string;
        name: string;
    };
    /**
     * Construct paths to make an import path
     */
    importPath(...paths: string[]): string;
    /**
     * Converts an entity name to database table name
     */
    tableName(entityName: string): string;
    /**
     * Converts an entity name to model name
     */
    modelName(entityName: string): string;
    /**
     * Converts an entity name to model file name
     */
    modelFileName(entityName: string): string;
    /**
     * Converts an entity name to a controller name
     */
    controllerName(entityName: string, singular?: boolean): string;
    /**
     * Converts an entity name to a controller file name
     */
    controllerFileName(entityName: string, singular?: boolean): string;
    /**
     * Converts an entity name to an event name
     */
    eventName(entityName: string): string;
    /**
     * Converts an entity name to an event file name
     */
    eventFileName(entityName: string): string;
    /**
     * Converts an entity name to listener name
     */
    listenerName(entityName: string): string;
    /**
     * Converts an entity name to listener file name
     */
    listenerFileName(entityName: string): string;
    /**
     * Converts an entity name to middleware name
     */
    middlewareName(entityName: string): string;
    /**
     * Converts an entity name to middleware file name
     */
    middlewareFileName(entityName: string): string;
    /**
     * Converts an entity name to provider name
     */
    providerName(entityName: string): string;
    /**
     * Converts an entity name to provider file name
     */
    providerFileName(entityName: string): string;
    /**
     * Converts an entity name to policy name
     */
    policyName(entityName: string): string;
    /**
     * Converts an entity name to policy file name
     */
    policyFileName(entityName: string): string;
    /**
     * Converts an entity name to factory name
     */
    factoryName(entityName: string): string;
    /**
     * Converts an entity name to factory file name
     */
    factoryFileName(entityName: string): string;
    /**
     * Converts an entity name to service name
     */
    serviceName(entityName: string): string;
    /**
     * Converts an entity name to service file name
     */
    serviceFileName(entityName: string): string;
    /**
     * Converts an entity name to seeder name
     */
    seederName(entityName: string): string;
    /**
     * Converts an entity name to seeder file name
     */
    seederFileName(entityName: string): string;
    /**
     * Converts an entity name to command terminal name
     */
    commandTerminalName(entityName: string): string;
    /**
     * Converts an entity name to command name
     */
    commandName(entityName: string): string;
    /**
     * Converts an entity name to command file name
     */
    commandFileName(entityName: string): string;
    /**
     * Converts an entity name to validator name
     */
    validatorName(entityName: string): string;
    /**
     * Converts an entity name to validator action
     * name
     */
    validatorActionName(entityName: string, action: string): string;
    /**
     * Converts an entity name to validator file name
     */
    validatorFileName(entityName: string): string;
    /**
     * Converts an entity name to exception name
     */
    exceptionName(entityName: string): string;
    /**
     * Converts an entity name to exception file name
     */
    exceptionFileName(entityName: string): string;
    /**
     * Converts an entity name to mailer name
     */
    mailerName(entityName: string, type?: "notification" | "provision"): string;
    /**
     * Converts an entity name to mailer file name
     */
    mailerFileName(entityName: string, type?: "notification" | "provision"): string;
    /**
     * Converts an entity name to class-based mail name
     */
    mailName(entityName: string, type?: string): string;
    /**
     * Converts an entity name to class-name mail filename
     */
    mailFileName(entityName: string, type?: string): string;
    /**
     * Converts an entity to test group name
     */
    testGroupName(entity: {
        path: string;
        name: string;
    }): string;
    /**
     * Converts an entity name to test file name
     */
    testFileName(entityName: string): string;
    /**
     * Converts an entity name to the view template file
     */
    viewFileName(entityName: string): string;
};
export default generators;
