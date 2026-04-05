import { oneOf } from './one_of.js';
import { number } from './number.js';
import { string } from './string.js';
import { boolean } from './boolean.js';
export declare const schema: {
    number: typeof number;
    string: typeof string;
    boolean: typeof boolean;
    enum: typeof oneOf;
};
