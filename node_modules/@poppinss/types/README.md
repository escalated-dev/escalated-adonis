# @poppinss/types

> A collection of types-only helpers used across all the AdonisJS, Edge, VineJS, and Japa packages

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Usage

This package contains types-only helpers with no runtime code. You can install it from the npm packages registry.

```sh
npm i @poppinss/types
```

## Helpers

Following is the list of available helpers

### `InferRouteParams<Identifier>`

Infer params of a route pattern. Helper supports the AdonisJS routing syntax only.

```ts
import type { InferRouteParams } from '@poppinss/types'

InferRouteParams<'/users'> // {}
InferRouteParams<'/users/:id'> // { id: string }
InferRouteParams<'/users/:id?'> // { id?: string }
InferRouteParams<'/users/:id/:slug?'> // { id: string; slug?: string }
InferRouteParams<'/users/:id.json'> // { id: string }
InferRouteParams<'/users/*'> // { '*': string[] }
InferRouteParams<'/posts/:category/*'> // { 'category': string; '*': string[] }
```

### `Prettify<T>`

Prettifies the complex TypeScript types to a simplified type for a better viewing experience. For example:

```ts
import type { Prettify } from '@poppinss/types'
import type { ExtractDefined, ExtractUndefined } from '@poppinss/types'

type Values = {
  username: string | undefined
  email: string
  fullName: string | undefined
  age: number | undefined
}

// When not using prettify helper
type WithUndefinedOptional = {
  [K in ExtractDefined<Values>]: Values[K]
} & {
  [K in ExtractUndefined<Values>]: Values[K]
}

// When using prettify helper
type WithUndefinedOptionalPrettified = Prettify<
  {
    [K in ExtractDefined<Values>]: Values[K]
  } & {
    [K in ExtractUndefined<Values>]: Values[K]
  }
>
```

![](./assets/not-prettified.png)
![](./assets/prettified.png)

### `Primitive`

Union of primitive types. It includes `null | undefined | string | number | boolean | symbol | bigint`

```ts
import type { Primitive } from '@poppinss/types'

function serialize(
  values:
    | Primitive
    | Record<string, Primitive | Primitive[]>
    | Primitive[]
    | Record<string, Primitive | Primitive[]>[]
) {}
```

### `OneOrMore<T>`

Specify a union that accepts either `T` or `T[]`.

```ts
import type { OneOrMore } from '@poppinss/types'
import type { Primitive } from '@poppinss/types'

function serialize(
  values: OneOrMore<Primitive> | OneOrMore<Record<string, Primitive | Primitive[]>>
) {}
```

### `Constructor<T, Arguments>`

Represent a class constructor. The `T` refers to the class instance properties, and `Arguments` refers to the constructor arguments.

```ts
import type { Constructor } from '@poppinss/types'

function make<Args extends any[]>(Klass: Constructor<any, Args>, ...args: Args) {
  return new Klass(...args)
}
```

### `AbstractConstructor<T, Arguments>`

Represent a class constructor that could also be abstract. The `T` refers to the class instance properties, and `Arguments` refers to the constructor arguments.

```ts
import type { AbstractConstructor } from '@poppinss/types'
function log<Args extends any[]>(Klass: AbstractConstructor<any, Args>, ...args: Args) {}
```

### `LazyImport<DefaultExport>`

Represent a function that lazily imports a module with `export default`.

```ts
import type { LazyImport, Constructor } from '@poppinss/types'

function middleware(list: LazyImport<Constructor<{ handle(): any }>>[]) {}
```

### `UnWrapLazyImport<Fn>`

Unwrap the default export of a `LazyImport` function.

```ts
import type { LazyImport, UnWrapLazyImport } from '@poppinss/types'

type Middleware = LazyImport<Constructor<{ handle(): any }>>
type MiddlewareClass = UnWrapLazyImport<Middleware>
```

### `NormalizeConstructor<T>`

Normalizes the constructor arguments of a class for use with mixins. The helper is created to work around [TypeScript issue#37142](https://github.com/microsoft/TypeScript/issues/37142).

**Usage without NormalizeConstructor**

```ts
class Base {}

function DatesMixin<TBase extends typeof Base>(superclass: TBase) {
  // A mixin class must have a constructor with a single rest parameter of type 'any[]'. ts(2545)
  return class HasDates extends superclass {
    //          ❌ ^^
    declare createdAt: Date
    declare updatedAt: Date
  }
}

// Base constructors must all have the same return type.ts(2510)
class User extends DatesMixin(Base) {}
//                    ❌ ^^
```

**Using NormalizeConstructor**

```ts
import type { NormalizeConstructor } from '@poppinss/types'

class Base {}

function DatesMixin<TBase extends NormalizeConstructor<typeof Base>>(superclass: TBase) {
  return class HasDates extends superclass {
    declare createdAt: Date
    declare updatedAt: Date
  }
}

class User extends DatesMixin(Base) {}
```

### `Opaque<T>`

Define an opaque type to distinguish between similar properties.

```ts
import type { Opaque } from '@poppinss/types'

type Username = Opaque<string, 'username'>
type Password = Opaque<string, 'password'>

function checkUser(_: Username) {}

// ❌ Argument of type 'string' is not assignable to parameter of type 'Opaque<string, "username">'.
checkUser('hello')

// ❌ Argument of type 'Opaque<string, "password">' is not assignable to parameter of type 'Opaque<string, "username">'.
checkUser('hello' as Password)

checkUser('hello' as Username)
```

### `UnwrapOpaque<T>`

Unwrap the value from an opaque type.

```ts
import type { Opaque, UnwrapOpaque } from '@poppinss/types'

type Username = Opaque<string, 'username'>
type Password = Opaque<string, 'password'>

type UsernameValue = UnwrapOpaque<Username> // string
type PasswordValue = UnwrapOpaque<Password> // string
```

### `ExtractFunctions<T, IgnoreList>`

Extract all the functions from an object. Optionally specify a list of methods to ignore.

```ts
import type { ExtractFunctions } from '@poppinss/types'

class User {
  declare id: number
  declare username: string

  create() {}
  update(_id: number, __attributes: any) {}
}

type UserMethods = ExtractFunctions<User> // 'create' | 'update'
```

You may use the `IgnoreList` to ignore methods from a known parent class

```ts
import type { ExtractFunctions } from '@poppinss/types'

class Base {
  save() {}
}

class User extends Base {
  declare id: number
  declare username: string

  create() {}
  update(_id: number, __attributes: any) {}
}

type UserMethods = ExtractFunctions<User> // 'create' | 'update' | 'save'
type UserMethodsWithParent = ExtractFunctions<User, ExtractFunctions<Base>> // 'create' | 'update'
```

### `AreAllOptional<T>`

Check if all the top-level properties of an object are optional.

```ts
import type { AreAllOptional } from '@poppinss/types'

AreAllOptional<{ id: string; name?: string }> // false
AreAllOptional<{ id?: string; name?: string }> // true
```

### `ExtractUndefined<T>`

Extract properties that are `undefined` or are a union with `undefined` values.

```ts
import type { ExtractUndefined } from '@poppinss/types'

type UndefinedProperties = ExtractUndefined<{ id: string; name: string | undefined }>
```

### `ExtractDefined<T>`

Extract properties that are not `undefined` nor is a union with `undefined` values.

```ts
import type { ExtractDefined } from '@poppinss/types'

type UndefinedProperties = ExtractDefined<{ id: string; name: string | undefined }>
```

### `AsyncOrSync<T>`

Define a union with the value or a `PromiseLike` of the value.

```ts
import type { AsyncOrSync } from '@poppinss/types'

function log(fetcher: () => AsyncOrSync<{ id: number }>) {
  const { id } = await fetcher()
}
```

### `DeepPartial<T>`

Mark nested properties as partial until unlimited depth.

```ts
import type { DeepPartial } from '@poppinss/types'

type Config = {
  http: {
    bodyParser: {
      enabled: boolean
    }
    qs: {
      parse: {
        quotes: boolean
      }
    }
  }
}

export function defineConfig(config: DeepPartial<Config>): Config {}
```

## Contributing

One of the primary goals of Poppinss is to have a vibrant community of users and contributors who believes in the principles of the framework.

We encourage you to read the [contribution guide](https://github.com/poppinss/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

## Code of Conduct

In order to ensure that the Poppinss community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/poppinss/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License

@poppinss/types is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/poppinss/types/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/poppinss/types/actions/workflows/checks.yml 'Github action'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[npm-image]: https://img.shields.io/npm/v/@poppinss/types.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@poppinss/types 'npm'
[license-image]: https://img.shields.io/npm/l/@poppinss/types?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
