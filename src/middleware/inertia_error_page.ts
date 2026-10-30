import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'
import { t } from '../support/i18n.js'
import { isUiEnabled } from '../rendering/renderer.js'

/** The shared frontend's refusal and not-found screen. */
export const ERROR_PAGE = 'Escalated/Error'

/** The statuses the page has wording for (`errors.{status}` in the lang files). */
export const ERROR_STATUSES = [403, 404, 419, 429, 500, 503] as const

/**
 * Escalated routes no Inertia visit goes to: the JSON API, the widget, inbound
 * mail webhooks, and single sign-on (an IdP's form post, the browser's
 * redirects). Whatever headers a request to them carries, they answer as
 * they always have.
 */
const NON_PAGE_ROUTES = [
  'escalated.api.',
  'escalated.widget.',
  'escalated.inbound.',
  'escalated.sso.',
]

/** The generic message for a status. A view's or exception's own text never reaches the page. */
export function errorMessage(status: number): string {
  return t(`errors.${status}`)
}

/**
 * Answers an Inertia visit to one of Escalated's routes that ends in 403, 404,
 * 419, 429, 500 or 503 with the shared `Escalated/Error` page.
 *
 * Without it the Inertia client gets the host's error body back (or one of
 * Escalated's own `{ error }` refusals) and can only show it in a modal over
 * the screen the user was on. The props are the ones Rails and Laravel send:
 * `status` and a generic, translated `message`.
 *
 * The provider adds this as router middleware, so it runs after a route has
 * matched and around every route's own middleware and handler. It answers only
 * when the request carries `X-Inertia`, the matched route is one of
 * Escalated's screens (named `escalated.*`, outside NON_PAGE_ROUTES) and the
 * status is one of ERROR_STATUSES.
 * Anything else -- full page loads, JSON and API clients, host routes, other
 * statuses -- is passed through untouched, and an error it does not answer is
 * rethrown to the host's exception handler. While the app runs in development
 * a 500 is left to the host's handler too, so its debug page shows the error.
 * A 500 it does answer is still logged, as the default exception handler
 * would report it.
 */
export default class InertiaErrorPage {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!this.#applies(ctx)) {
      return next()
    }

    try {
      await next()
    } catch (error: any) {
      const status = statusOf(error)
      if (!this.#answers(status)) throw error
      if (status >= 500) ctx.logger.error({ err: error }, 'Escalated request failed')
      return this.#render(ctx, status)
    }

    const status = ctx.response.getStatus()
    if (this.#answers(status) && !isInertiaPage(ctx)) {
      return this.#render(ctx, status)
    }
  }

  #applies(ctx: HttpContext): boolean {
    const name = ctx.route?.name
    return (
      Boolean(ctx.request.header('x-inertia')) &&
      typeof name === 'string' &&
      name.startsWith('escalated.') &&
      !NON_PAGE_ROUTES.some((prefix) => name.startsWith(prefix)) &&
      isUiEnabled()
    )
  }

  #answers(status: number): boolean {
    if (!(ERROR_STATUSES as readonly number[]).includes(status)) return false
    return !(status === 500 && app.inDev)
  }

  async #render(ctx: HttpContext, status: number) {
    // Drop whatever the route had started to answer with (headers it set for
    // its own body, a lazy body) before the page replaces it.
    ctx.response.removeHeader('content-type')
    ctx.response.removeHeader('location')

    // @adonisjs/inertia returns the page object (and sets `X-Inertia`) for the
    // router to send; a middleware has to send it itself.
    const page = await (ctx as any).inertia.render(ERROR_PAGE, {
      status,
      message: errorMessage(status),
    })
    if (page !== undefined && page !== null) ctx.response.send(page)
    ctx.response.status(status)
  }
}

/** The status an error asks for, as the default exception handler reads it. */
function statusOf(error: any): number {
  const status = Number(error?.status)
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500
}

/** Whether the response is already an Inertia page (rendered with the header). */
function isInertiaPage(ctx: HttpContext): boolean {
  return Boolean(ctx.response.getHeader('x-inertia'))
}
