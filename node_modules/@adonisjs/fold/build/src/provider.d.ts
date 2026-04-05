import type { ContainerResolver } from './resolver.js';
import type { InspectableConstructor } from './types.js';
/**
 * The default provider for resolving dependencies. It uses the resolver
 * to resolve all the values.
 */
export declare function containerProvider(binding: InspectableConstructor, property: string | symbol | number, resolver: ContainerResolver<any>, runtimeValues?: any[]): Promise<any[]>;
