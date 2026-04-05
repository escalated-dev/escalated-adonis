export type ExtractRelationCallback<T extends (...args: any[]) => any, Callback = NonNullable<Parameters<T>[1]>> = Callback extends (...args: any[]) => any ? Parameters<Callback>[0] : never;
