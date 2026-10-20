import { getConfig } from '../helpers/config.js'

/*
|--------------------------------------------------------------------------
| The host application's user model
|--------------------------------------------------------------------------
|
| `config.userModel` names the host's user model. The stub's default is
| `'#models/user'`, an alias in the *host's* package.json `imports`. Node
| resolves a `#` specifier against the package.json nearest the file that
| imports it, so `import('#models/user')` written in this package never sees
| the host's map and throws ERR_PACKAGE_IMPORT_NOT_DEFINED.
|
| Every lookup of the user model goes through `resolveUserModel()`, which
| imports through the application's importer (`app.import()`), the same way
| `#start/kernel` is reached in route_middleware.ts. That importer is the
| closure the host hands its Ignitor in `bin/server.ts`, so it resolves the
| host's aliases.
|
*/

/**
 * What `config.userModel` may hold:
 *  - an import specifier: `'#models/user'` (default), a path or a file URL;
 *  - a bare class name such as `'User'`, read as `#models/user`;
 *  - the model class itself;
 *  - a loader, `() => import('#models/user')`, written in the host's config.
 */
export type UserModelReference = string | ((...args: any[]) => any)

const DEFAULT_USER_MODEL = '#models/user'

type Importer = (specifier: string) => Promise<any>

async function hostImporter(): Promise<Importer> {
  try {
    const { default: app } = await import('@adonisjs/core/services/app')
    if (app && typeof (app as any).import === 'function') {
      return (specifier) => (app as any).import(specifier)
    }
  } catch {
    // No application (a standalone script): fall back to a plain import.
  }
  return (specifier) => import(specifier)
}

/** A bare identifier such as `User` or `AdminUser` is a class name, not a specifier. */
function isClassName(reference: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(reference)
}

function toSpecifier(reference: string): string {
  if (!isClassName(reference)) return reference
  const snake = reference.replace(
    /([A-Z])/g,
    (_m, c: string, i: number) => (i > 0 ? '_' : '') + c.toLowerCase()
  )
  return `#models/${snake}`
}

/** A model class has a static `find`; a loader does not. */
function isModelClass(value: unknown): boolean {
  return typeof value === 'function' && typeof (value as any).find === 'function'
}

function unwrap(module: any): any {
  return module && typeof module === 'object' && 'default' in module ? module.default : module
}

/**
 * The host application's user model class, resolved from `config.userModel`.
 *
 * Throws when it cannot be resolved, naming the setting; callers that treat a
 * missing model as "no user" catch it themselves.
 */
export async function resolveUserModel(importer?: Importer): Promise<any> {
  const reference: UserModelReference = (getConfig() as any).userModel || DEFAULT_USER_MODEL

  if (isModelClass(reference)) return reference

  let model: any
  try {
    if (typeof reference === 'function') {
      model = unwrap(await reference())
    } else {
      const load = importer ?? (await hostImporter())
      model = unwrap(await load(toSpecifier(reference)))
    }
  } catch (error) {
    throw new Error(
      `Escalated: config.userModel (${typeof reference === 'string' ? `"${reference}"` : 'a loader'}) ` +
        `could not be imported: ${(error as Error).message}`
    )
  }

  if (!isModelClass(model)) {
    throw new Error(
      'Escalated: config.userModel did not resolve to a model class with a static find().'
    )
  }
  return model
}

/** Finds a host user by id, or null when there is none. */
export async function findHostUser(id: string | number | null | undefined): Promise<any> {
  if (id === null || id === undefined || id === '') return null
  const User = await resolveUserModel()
  return (await User.find(id)) ?? null
}

/**
 * The type Escalated records in polymorphic columns (`requester_type`,
 * `author_type`) for a host user: the model's class name, as every path that
 * has the user instance stores `user.constructor.name`.
 */
export async function userModelTypeName(): Promise<string> {
  const User = await resolveUserModel()
  return User.name
}
