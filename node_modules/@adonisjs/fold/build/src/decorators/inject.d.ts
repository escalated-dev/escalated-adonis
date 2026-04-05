/**
 * The "@inject" decorator uses Reflection to inspect the dependencies of a class
 * or a method and defines them as metaData on the class for the container to
 * discover them.
 */
export declare function inject(): {
    <C extends Function>(target: C): void;
    (target: any, propertyKey: string | symbol): void;
};
