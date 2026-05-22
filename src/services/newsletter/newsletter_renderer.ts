import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import NewsletterDelivery from '../../models/newsletter/newsletter_delivery.js'

const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel']
const __dirname = dirname(fileURLToPath(import.meta.url))

export interface RendererOptions {
  baseUrl?: string
  appName?: string
  defaultTheme?: string
  trackingEnabled?: boolean
  themesDir?: string
  brand?: {
    name?: string
    accent?: string
    logoUrl?: string
    physicalAddress?: string
  }
  /** Host-supplied Markdown -> HTML converter. Default: minimal escape+paragraph fallback. */
  markdownToHtml?: (md: string) => string
}

export default class NewsletterRenderer {
  constructor(private readonly options: RendererOptions = {}) {}

  render(delivery: NewsletterDelivery): string {
    const newsletter = delivery.newsletter
    const contact = delivery.contact
    const baseUrl = (this.options.baseUrl ?? 'http://localhost').replace(/\/+$/, '')
    const themeSlug = newsletter.theme ?? newsletter.template?.theme ?? this.options.defaultTheme ?? 'default'
    const bodyMd = newsletter.bodyMarkdown ?? newsletter.template?.bodyMarkdown ?? ''
    const md = this.options.markdownToHtml ?? this.defaultMarkdown

    let body = md(bodyMd)
    body = this.resolveMergeFields(body, contact, delivery, baseUrl)

    const themesDir = this.options.themesDir ?? join(__dirname, '../../../resources/views/newsletter_themes')
    const themed = this.renderTheme(themeSlug, themesDir, {
      subject: newsletter.subject,
      body,
      unsubscribe_url: this.unsubscribeUrl(delivery, baseUrl),
      view_in_browser_url: this.viewInBrowserUrl(delivery, baseUrl),
      brand: {
        name: this.options.brand?.name ?? this.options.appName ?? 'Support',
        accent: this.options.brand?.accent ?? '#2563eb',
        logo_url: this.options.brand?.logoUrl ?? '',
        physical_address: this.options.brand?.physicalAddress ?? '',
      },
    })

    if (this.options.trackingEnabled === false) return themed
    return this.injectPixel(this.rewriteLinks(themed, delivery, baseUrl), delivery, baseUrl)
  }

  unsubscribeUrl(delivery: NewsletterDelivery, baseUrl?: string): string {
    const b = (baseUrl ?? this.options.baseUrl ?? 'http://localhost').replace(/\/+$/, '')
    return `${b}/escalated/n/u/${delivery.trackingToken}`
  }

  viewInBrowserUrl(delivery: NewsletterDelivery, baseUrl?: string): string {
    const b = (baseUrl ?? this.options.baseUrl ?? 'http://localhost').replace(/\/+$/, '')
    return `${b}/escalated/n/v/${delivery.trackingToken}`
  }

  private defaultMarkdown(md: string): string {
    const escaped = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return '<p>' + escaped.split(/\n{2,}/).join('</p><p>') + '</p>'
  }

  private resolveMergeFields(
    html: string,
    contact: any,
    delivery: NewsletterDelivery,
    baseUrl: string,
  ): string {
    return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
      const v = this.resolvePath(path.trim(), contact, delivery, baseUrl)
      return this.escape(v)
    })
  }

  private resolvePath(path: string, contact: any, delivery: NewsletterDelivery, baseUrl: string): string {
    if (path === 'contact.name') return String(contact.name ?? '')
    if (path === 'contact.first_name') return String(contact.name ?? '').split(' ')[0] ?? ''
    if (path === 'contact.email') return String(contact.email ?? '')
    if (path === 'unsubscribe_url') return this.unsubscribeUrl(delivery, baseUrl)
    if (path === 'view_in_browser_url') return this.viewInBrowserUrl(delivery, baseUrl)
    if (path.startsWith('contact.metadata.')) {
      const key = path.slice('contact.metadata.'.length)
      const meta = (contact.metadata ?? {}) as Record<string, unknown>
      const v = meta[key]
      return v == null ? '' : String(v)
    }
    return ''
  }

  private renderTheme(slug: string, themesDir: string, locals: Record<string, unknown>): string {
    const candidate = join(themesDir, `${slug}.edge`)
    const path = existsSync(candidate) ? candidate : join(themesDir, 'default.edge')
    const source = readFileSync(path, 'utf8')
    // Lightweight Edge-like substitution: {{ expr }} and {{{ expr }}} are supported
    // for the template's variable references. Hosts that want real Edge can register
    // their own renderer; this keeps the package's runtime dependency-free.
    return source
      .replace(/\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}/g, (_, key) => String(this.lookup(locals, key)))
      .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => this.escape(String(this.lookup(locals, key))))
  }

  private lookup(locals: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), locals) ?? ''
  }

  private rewriteLinks(html: string, delivery: NewsletterDelivery, baseUrl: string): string {
    const unsubPrefix = this.unsubscribeUrl(delivery, baseUrl)
    const viewPrefix = this.viewInBrowserUrl(delivery, baseUrl)
    return html.replace(/(<a\s[^>]*\bhref=)(["'])(.*?)\2/gi, (match, prefix, quote, href: string) => {
      if (!href || href.startsWith('#')) return match
      const scheme = (href.split(':')[0] ?? '').toLowerCase()
      if (!ALLOWED_SCHEMES.includes(scheme)) return `${prefix}${quote}#${quote}`
      if (scheme === 'mailto' || scheme === 'tel') return match
      if (href.startsWith(unsubPrefix) || href.startsWith(viewPrefix)) return match
      const encoded = Buffer.from(href).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      return `${prefix}${quote}${baseUrl}/escalated/n/c/${delivery.trackingToken}?u=${encoded}${quote}`
    })
  }

  private injectPixel(html: string, delivery: NewsletterDelivery, baseUrl: string): string {
    const url = `${baseUrl}/escalated/n/o/${delivery.trackingToken}.gif`
    const pixel = `<img src="${this.escape(url)}" width="1" height="1" alt="" />`
    if (html.includes('</body>')) return html.replace('</body>', `${pixel}</body>`)
    return html + pixel
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
