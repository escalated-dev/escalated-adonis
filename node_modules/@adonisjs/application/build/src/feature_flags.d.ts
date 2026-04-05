/**
 * A light weight implementation of feature flags to conditionally enable
 * experimental and legacy features.
 */
export declare class FeatureFlags<FlagsList extends Record<any, any>> {
    #private;
    constructor(flags: FlagsList | (() => FlagsList));
    enabled<Feature extends keyof FlagsList | (string & {})>(feature: Feature): boolean;
    disabled<Feature extends keyof FlagsList | (string & {})>(feature: Feature): boolean;
    has<Feature extends keyof FlagsList | (string & {})>(feature: Feature): boolean;
    when<Feature extends keyof FlagsList | (string & {}), EnabledResult, DisabledResult>(feature: Feature, enabledCallback: () => EnabledResult, disabledCallback?: () => DisabledResult): [never] extends DisabledResult ? EnabledResult | undefined : EnabledResult | DisabledResult;
}
