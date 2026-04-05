import type { BytesOptions } from 'bytes';
/**
 * Bytes formatter and parser
 */
export declare const bytes: {
    format(bytes: number, options?: BytesOptions): string;
    parse(value: string | number): number;
};
