import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The standalone widget bundle, `resources/widget/escalated-widget.js`, built
 * by @escalated-dev/escalated and vendored here (copied to
 * `build/resources/widget` on build). Any site can load it with a <script> tag
 * pointing at this install.
 */
export const WIDGET_BUNDLE = new URL('../../resources/widget/escalated-widget.js', import.meta.url)

let bundle: Promise<{ body: Buffer; etag: string } | null> | null = null

function loadBundle() {
  bundle ??= readFile(WIDGET_BUNDLE).then(
    (body) => ({ body, etag: `"${createHash('md5').update(body).digest('hex')}"` }),
    () => {
      bundle = null
      return null
    }
  )
  return bundle
}

export default class WidgetScriptController {
  async show({ request, response }: HttpContext) {
    const loaded = await loadBundle()
    if (!loaded) {
      return response.notFound({ error: 'Widget script not found' })
    }

    response.header('Content-Type', 'application/javascript; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=3600')
    response.header('ETag', loaded.etag)
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')
    response.header('Access-Control-Allow-Origin', '*')

    const ifNoneMatch = String(request.header('if-none-match') ?? '')
    const tags = ifNoneMatch.split(',').map((tag) => tag.trim())
    if (tags.includes(loaded.etag) || tags.includes(`W/${loaded.etag}`)) {
      response.status(304)
      return response.send('')
    }

    return response.send(loaded.body)
  }
}
