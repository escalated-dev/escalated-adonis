import { BaseModel } from '@adonisjs/lucid/orm'
import { connectionName } from '../helpers/config.js'

/**
 * Base class for every Escalated model.
 *
 * All of Escalated's tables resolved the host application's default Lucid
 * connection with no way to change it, which made the package unusable in any
 * host that partitions its database: a schema shared with a legacy system, a
 * multi-tenant split, a separate reporting store, or simply a host that would
 * rather keep support tables out of its primary database.
 *
 * `connection` is a getter rather than the plain static string Lucid normally
 * takes, because the value comes from runtime config that is not loaded when
 * these classes are defined. Lucid reads `modelConstructor.connection` when it
 * resolves a query client, so a getter satisfies it at exactly the right
 * moment.
 *
 * Returning undefined -- the default when no connection is configured -- is
 * what a plain BaseModel does, so an unconfigured host is unchanged.
 *
 * The host's user model deliberately does not inherit this. It belongs to the
 * host, and Escalated stores host user ids as plain unconstrained columns
 * precisely so the two can live on different connections.
 */
export default class EscalatedBaseModel extends BaseModel {
  static get connection(): string {
    return connectionName() as string
  }

  static set connection(value: string) {
    // Lucid assigns this during boot for models that declare one explicitly.
    // Honour an explicit assignment so a host subclassing an Escalated model
    // can still pin it, and fall back to config otherwise.
    Object.defineProperty(this, 'connection', {
      value,
      writable: true,
      configurable: true,
    })
  }
}
