/**
 * Check if the provided value is a valid IP address
 */
export declare function isIP(str: string, version?: 4 | 6): boolean;
export declare function isFQDN(str: string, options?: Partial<{
    require_tld: boolean;
    allow_underscores: boolean;
    allow_trailing_dot: boolean;
    allow_numeric_tld: boolean;
    allow_wildcard: boolean;
    ignore_max_length: boolean;
}>): boolean;
export declare function isURL(url: string, options?: Partial<{
    protocols: string[];
    require_tld: boolean;
    require_protocol: boolean;
    require_host: boolean;
    require_port: boolean;
    disallow_auth: boolean;
    require_valid_protocol: boolean;
    allow_underscores: boolean;
    allow_trailing_dot: boolean;
    allow_protocol_relative_urls: boolean;
    allow_fragments: boolean;
    allow_query_components: boolean;
    validate_length: boolean;
    max_allowed_length: number;
}>): boolean;
export declare function isEmail(str: string, options?: Partial<{
    allow_display_name: boolean;
    allow_underscores: boolean;
    require_display_name: boolean;
    allow_utf8_local_part: boolean;
    ignore_max_length: boolean;
    require_tld: boolean;
}>): boolean;
export declare function isUUID(str: string): boolean;
