import EscalatedSetting from '../../models/escalated_setting.js'

export default class BounceSuppressionStore {
  private static readonly KEY = 'newsletter.suppressed_emails'

  async markBounced(email: string): Promise<void> {
    await this.mark(email)
  }

  async markComplained(email: string): Promise<void> {
    await this.mark(email)
  }

  async isBounced(email: string): Promise<boolean> {
    const list = await this.load()
    return list.includes(email.toLowerCase())
  }

  async filterSendable(emails: string[]): Promise<string[]> {
    const suppressed = new Set(await this.load())
    return emails.filter((e) => !suppressed.has(e.toLowerCase()))
  }

  private async mark(email: string): Promise<void> {
    const lower = email.toLowerCase()
    const list = await this.load()
    if (list.includes(lower)) return
    list.push(lower)
    await EscalatedSetting.updateOrCreate(
      { key: BounceSuppressionStore.KEY },
      { value: JSON.stringify(list) }
    )
  }

  private async load(): Promise<string[]> {
    const row = await EscalatedSetting.findBy('key', BounceSuppressionStore.KEY)
    if (!row?.value) return []
    try {
      const parsed = JSON.parse(row.value)
      return Array.isArray(parsed) ? parsed.map((e: string) => String(e).toLowerCase()) : []
    } catch {
      return []
    }
  }
}
