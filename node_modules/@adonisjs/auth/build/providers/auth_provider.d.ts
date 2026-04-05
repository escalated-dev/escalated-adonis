import type { ApplicationService } from '@adonisjs/core/types';
import type { AuthService } from '../src/types.js';
declare module '@adonisjs/core/types' {
    interface ContainerBindings {
        'auth.manager': AuthService;
    }
}
export default class AuthProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    register(): void;
}
