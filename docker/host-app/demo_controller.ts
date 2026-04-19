import type { HttpContext } from '@adonisjs/core/http'

export default class DemoController {
  async index({ response }: HttpContext) {
    return response.type('text/html').send(`
      <html><body><h1>Escalated Adonis Demo</h1>
      <p>Host project bootstrapped (AdonisJS 6 + Inertia + Postgres). The
      escalated-adonis package is intentionally not installed in this
      container while
      <a href="https://github.com/escalated-dev/escalated-adonis/issues/34">#34</a>
      is fixed upstream — see PR body. Once the package builds cleanly,
      adding the path-dep + click-login picker is a small follow-up.</p>
      </body></html>
    `)
  }
}
