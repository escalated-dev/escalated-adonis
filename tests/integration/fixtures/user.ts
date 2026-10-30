/**
 * Plays the host application's user model (`config.userModel`) in integration
 * tests. Escalated only needs `find()` from it.
 *
 * The users are instances of this class, as a host's users are instances of
 * its model: Escalated records `user.constructor.name` as the type in
 * polymorphic columns such as a ticket's requester, and compares it when it
 * checks who owns a ticket.
 */

export type TestUser = { id: number; role: 'admin' | 'agent' | 'customer' }

export default class User implements TestUser {
  declare id: number
  declare role: TestUser['role']
  #name: string | null = null
  #email: string | null = null
  password: string | null = null

  constructor(id: number, role: TestUser['role']) {
    this.id = id
    this.role = role
  }

  /** Read where a person is shown by name, such as the widget's chat transcript. */
  get name(): string {
    return this.#name ?? `${this.role[0].toUpperCase()}${this.role.slice(1)} ${this.id}`
  }

  /** Read by inbound email, which compares a sender to the requester's address. */
  get email(): string {
    return this.#email ?? `user${this.id}@example.test`
  }

  static async find(id: number | string): Promise<User | null> {
    return allUsers().find((user) => String(user.id) === String(id)) ?? null
  }

  /** Read by Admin > Users as the host's `is_admin` / `is_agent` columns. */
  get isAdmin(): boolean {
    return this.role === 'admin'
  }

  get isAgent(): boolean {
    return this.role !== 'customer'
  }

  /**
   * The slices of a Lucid query Escalated uses: SSO matching an email
   * case-insensitively (`query().whereRaw('LOWER(email) = ?', [email]).first()`)
   * and Admin > Users listing a page of users
   * (`query().where(...).orderBy(...).paginate(page, perPage)`, in id order).
   */
  static query() {
    let email = ''
    const builder = {
      whereRaw(_sql: string, bindings: string[]) {
        email = String(bindings[0] ?? '')
        return builder
      },
      where() {
        return builder
      },
      orderBy() {
        return builder
      },
      async first() {
        return allUsers().find((user) => user.email.toLowerCase() === email) ?? null
      },
      async paginate(page: number, perPage: number) {
        const users = [...allUsers()].sort((a, b) => a.id - b.id)
        const rows = users.slice((page - 1) * perPage, page * perPage)
        return {
          all: () => rows,
          currentPage: page,
          perPage,
          total: users.length,
          lastPage: Math.max(1, Math.ceil(users.length / perPage)),
        }
      },
    }
    return builder
  }

  /** Like Lucid's `create()`: a new customer with the given email and name. */
  static async create(values: { email: string; name?: string; password?: string }) {
    const user = new User(100 + CREATED.length, 'customer')
    user.#email = values.email
    user.#name = values.name ?? null
    user.password = values.password ?? null
    CREATED.push(user)
    return user
  }

  /** Forgets the users `create()` made. */
  static forgetCreated() {
    CREATED.length = 0
  }
}

const CREATED: User[] = []

function allUsers(): User[] {
  return [...Object.values(TEST_USERS), ...CREATED]
}

export const TEST_USERS = {
  admin: new User(1, 'admin'),
  agent: new User(2, 'agent'),
  customer: new User(3, 'customer'),
  otherCustomer: new User(4, 'customer'),
}
