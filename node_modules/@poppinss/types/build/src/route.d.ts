import { type Prettify } from './base.ts';
/**
 * Infers param segment from the route identifier.
 */
export type ParamSegment<Identifier extends string> = Identifier extends `${infer SegmentA}/${infer SegmentB}` ? Param<SegmentA> | ParamSegment<SegmentB> : Param<Identifier>;
export type Param<Segment extends string> = Segment extends `:${string}?` ? never : Segment extends `:${infer ParamName}` ? ParamName extends `${infer ParamWithoutExt}.${string}` ? ParamWithoutExt : ParamName : never;
/**
 * Infers optional param segment from the route identifier.
 */
export type OptionalParamSegment<Identifier extends string> = Identifier extends `${infer SegmentA}/${infer SegmentB}` ? OptionalParam<SegmentA> | OptionalParamSegment<SegmentB> : OptionalParam<Identifier>;
export type OptionalParam<Segment extends string> = Segment extends `:${infer ParamName}?` ? ParamName : never;
/**
 * Infers wildcard param segment from the route identifier.
 */
export type WildcardParamSegment<Identifier extends string> = Identifier extends `${infer SegmentA}/${infer SegmentB}` ? WildcardParam<SegmentA> | WildcardParamSegment<SegmentB> : WildcardParam<Identifier>;
export type WildcardParam<Segment extends string> = Segment extends '*' ? '*' : never;
/**
 * Infer route params from the route idenfifier
 */
export type InferRouteParams<Identifier extends string> = Prettify<{
    [Key in ParamSegment<Identifier>]: string;
} & {
    [Key in OptionalParamSegment<Identifier>]?: string;
} & {
    [Key in WildcardParamSegment<Identifier>]: string[];
}>;
