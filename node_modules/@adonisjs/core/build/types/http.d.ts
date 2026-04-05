export * from '@adonisjs/http-server/types';
import type { ValidationOptions } from '@vinejs/vine/types';
/**
 * Validation options accepted by the "request.validateUsing" method
 */
export type RequestValidationOptions<MetaData extends undefined | Record<string, any>> = ValidationOptions<MetaData> & {
    data?: any;
};
