import type { AllowedInfoValues, UIPrimitives } from '../types.js';
/**
 * Info formatter is used to format the kernel info key-value pair
 * into a table.
 */
export default class InfoFormatter {
    #private;
    constructor(info: Map<string, AllowedInfoValues>, colors: UIPrimitives['colors']);
    /**
     * Formats the info map into an array of rows
     */
    format(): string[];
}
