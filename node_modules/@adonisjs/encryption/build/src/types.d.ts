import { type Secret } from '@poppinss/utils';
/**
 * Config accepted by the encryption
 */
export type EncryptionOptions = {
    algorithm?: 'aes-256-cbc';
    secret: string | Secret<string>;
};
