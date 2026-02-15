import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'
import { randomBytes, createHash } from 'node:crypto'

export default class ApiToken extends BaseModel {
  static table = 'escalated_api_tokens'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tokenableType: string

  @column()
  declare tokenableId: number

  @column()
  declare name: string

  @column()
  declare token: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare abilities: string[] | null

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column()
  declare lastUsedIp: string | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  /**
   * Load the tokenable (owner) model dynamically.
   * Since this is a morph relationship and we rely on the host app's user model,
   * we resolve it manually via the config's userModel path.
   */
  async loadTokenable(): Promise<any> {
    const config = (globalThis as any).__escalated_config
    try {
      const userModelPath = config?.userModel ?? '#models/user'
      const { default: UserModel } = await import(userModelPath)
      return UserModel.find(this.tokenableId)
    } catch {
      return null
    }
  }

  // ---- Methods ----

  /**
   * Check if the token has a given ability.
   */
  hasAbility(ability: string): boolean {
    const abilities = this.abilities ?? []
    return abilities.includes('*') || abilities.includes(ability)
  }

  /**
   * Check if the token has expired.
   */
  isExpired(): boolean {
    if (this.expiresAt === null) {
      return false
    }
    return this.expiresAt < DateTime.now()
  }

  // ---- Scopes ----

  static active = scope((query) => {
    query.where((q) => {
      q.whereNull('expires_at').orWhere('expires_at', '>', DateTime.now().toSQL()!)
    })
  })

  static expired = scope((query) => {
    query.whereNotNull('expires_at').where('expires_at', '<=', DateTime.now().toSQL()!)
  })

  // ---- Static Factory Methods ----

  /**
   * Create a new API token for a user.
   * Returns the model instance and the plain text token (shown only once).
   */
  static async createToken(
    user: { id: number; constructor: { name: string } },
    name: string,
    abilities: string[] = ['*'],
    expiresAt?: DateTime | null
  ): Promise<{ token: ApiToken; plainTextToken: string }> {
    const plainText = randomBytes(32).toString('hex')
    const hashed = createHash('sha256').update(plainText).digest('hex')

    const token = await ApiToken.create({
      tokenableType: user.constructor.name,
      tokenableId: user.id,
      name,
      token: hashed,
      abilities,
      expiresAt: expiresAt ?? null,
    })

    return { token, plainTextToken: plainText }
  }

  /**
   * Find a token by its plain text value.
   * Hashes the plain text with SHA-256 and looks up in the database.
   */
  static async findByPlainText(plainText: string): Promise<ApiToken | null> {
    const hashed = createHash('sha256').update(plainText).digest('hex')
    return ApiToken.query().where('token', hashed).first()
  }
}
