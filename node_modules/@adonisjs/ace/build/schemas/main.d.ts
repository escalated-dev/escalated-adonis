export declare const schema: {
    $ref: string;
    $schema: string;
    definitions: {
        CommandMetaData: {
            description: string;
            properties: {
                aliases: {
                    description: string;
                    items: {
                        type: string;
                    };
                    type: string;
                };
                args: {
                    description: string;
                    items: {
                        additionalProperties: boolean;
                        properties: {
                            allowEmptyValue: {
                                description: string;
                                type: string;
                            };
                            argumentName: {
                                type: string;
                            };
                            default: {};
                            description: {
                                type: string;
                            };
                            name: {
                                type: string;
                            };
                            required: {
                                type: string;
                            };
                            type: {
                                enum: string[];
                                type: string;
                            };
                        };
                        required: string[];
                        type: string;
                    };
                    type: string;
                };
                commandName: {
                    description: string;
                    type: string;
                };
                description: {
                    description: string;
                    type: string;
                };
                flags: {
                    description: string;
                    items: {
                        additionalProperties: boolean;
                        properties: {
                            alias: {
                                anyOf: ({
                                    type: string;
                                    items?: undefined;
                                } | {
                                    items: {
                                        type: string;
                                    };
                                    type: string;
                                })[];
                            };
                            allowEmptyValue: {
                                description: string;
                                type: string;
                            };
                            default: {};
                            description: {
                                type: string;
                            };
                            flagName: {
                                type: string;
                            };
                            name: {
                                type: string;
                            };
                            required: {
                                type: string;
                            };
                            showNegatedVariantInHelp: {
                                description: string;
                                type: string;
                            };
                            type: {
                                enum: string[];
                                type: string;
                            };
                        };
                        required: string[];
                        type: string;
                    };
                    type: string;
                };
                help: {
                    anyOf: ({
                        type: string;
                        items?: undefined;
                    } | {
                        items: {
                            type: string;
                        };
                        type: string;
                    })[];
                    description: string;
                };
                namespace: {
                    description: string;
                    type: string[];
                };
                options: {
                    $ref: string;
                    description: string;
                };
            };
            required: string[];
            type: string;
        };
        CommandOptions: {
            description: string;
            properties: {
                allowUnknownFlags: {
                    description: string;
                    type: string;
                };
                staysAlive: {
                    description: string;
                    type: string;
                };
            };
            type: string;
        };
    };
};
