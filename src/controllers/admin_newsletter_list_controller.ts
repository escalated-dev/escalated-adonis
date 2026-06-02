import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Contact from '../models/contact.js'
import NewsletterList from '../models/newsletter/newsletter_list.js'
import NewsletterListMember from '../models/newsletter/newsletter_list_member.js'
import { getRenderer } from '../rendering/renderer.js'
import ContactSegmentResolver from '../services/newsletter/contact_segment_resolver.js'
import NewsletterPermissionService from '../services/newsletter/newsletter_permission_service.js'
import { redirectToRoute } from '../support/routing.js'
import {
  assertArrayOrNull,
  assertOneOf,
  NewsletterValidationError,
  optionalString,
  requiredInteger,
  requiredString,
  userIdFromAuth,
  abort422,
} from '../support/newsletter_http.js'

export default class AdminNewsletterListController {
  private readonly permissions = new NewsletterPermissionService()
  private readonly segments = new ContactSegmentResolver()

  async index(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const lists = await NewsletterList.query().orderBy('name', 'asc')
    const enriched = await Promise.all(lists.map((list) => this.withCounts(list)))
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Lists/Index', { lists: enriched })
  }

  async create(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Lists/Create', {})
  }

  async store(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const body = ctx.request.all()
      const list = await NewsletterList.create({
        name: requiredString(body, 'name', 255),
        description: optionalString(body, 'description'),
        kind: assertOneOf(body.kind, 'kind', ['static', 'dynamic']) as 'static' | 'dynamic',
        filterJson: assertArrayOrNull(body.filter_json, 'filter_json') as any,
        createdBy: userIdFromAuth(ctx.auth.user) as number | null,
      })
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.show', { list: list.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async show(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const list = await this.findList(Number(ctx.params.list))
    const members = await NewsletterListMember.query()
      .where('list_id', list.id)
      .preload('contact', (q) => q.select('id', 'name', 'email'))
      .orderBy('id', 'desc')
      .paginate(100, ctx.request.input('page', 1))

    const matchCount =
      list.kind === 'dynamic'
        ? await this.segments.countMatches(list.filterJson ?? { rules: [] })
        : 0

    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Lists/Show', {
      list: await this.withCounts(list),
      members,
      matchCount,
    })
  }

  async update(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const list = await this.findList(Number(ctx.params.list))
      const body = ctx.request.all()
      if (body.name !== undefined) list.name = requiredString(body, 'name', 255)
      if (body.description !== undefined) list.description = optionalString(body, 'description')
      if (body.filter_json !== undefined) {
        list.filterJson = assertArrayOrNull(body.filter_json, 'filter_json') as any
      }
      await list.save()
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.show', { list: list.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async destroy(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const list = await this.findList(Number(ctx.params.list))
    await list.delete()
    redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.index')
  }

  async addMember(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const list = await this.findList(Number(ctx.params.list))
      this.assertStatic(list)
      const contactId = requiredInteger(ctx.request.all(), 'contact_id')
      const contact = await Contact.find(contactId)
      if (!contact) {
        throw new NewsletterValidationError('contact_id does not exist', {
          contact_id: 'contact_id does not exist',
        })
      }
      await NewsletterListMember.firstOrCreate(
        { listId: list.id, contactId },
        { addedBy: userIdFromAuth(ctx.auth.user) as number | null }
      )
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.show', { list: list.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async removeMember(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const list = await this.findList(Number(ctx.params.list))
      this.assertStatic(list)
      await NewsletterListMember.query()
        .where('list_id', list.id)
        .where('contact_id', Number(ctx.params.contactId))
        .delete()
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.show', { list: list.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async importCsv(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const list = await this.findList(Number(ctx.params.list))
      this.assertStatic(list)
      const file = ctx.request.file('file')
      if (!file) {
        throw new NewsletterValidationError('file is required', { file: 'file is required' })
      }
      if (!file.isValid) {
        throw new NewsletterValidationError(file.errors[0]?.message ?? 'Invalid file', {
          file: 'Invalid file',
        })
      }

      const text = file.tmpPath
        ? await readFile(file.tmpPath, 'utf-8')
        : String((file as any).toString?.() ?? '')
      let imported = 0
      for (const line of text.split(/\r?\n/)) {
        const email = line.split(',')[0]?.trim()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
        const contact = await Contact.findOrCreateByEmail(email)
        const exists = await NewsletterListMember.query()
          .where('list_id', list.id)
          .where('contact_id', contact.id)
          .first()
        if (!exists) {
          await NewsletterListMember.create({
            listId: list.id,
            contactId: contact.id,
            addedBy: userIdFromAuth(ctx.auth.user) as number | null,
          })
        }
        imported++
      }

      ctx.session.flash('status', `Imported ${imported} contacts`)
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.lists.show', { list: list.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  private async findList(id: number): Promise<NewsletterList> {
    const list = await NewsletterList.find(id)
    if (!list) throw new NewsletterValidationError(`Newsletter list #${id} not found`)
    return list
  }

  private assertStatic(list: NewsletterList): void {
    if (list.kind !== 'static') abort422('Dynamic lists are filter-driven')
  }

  private async withCounts(list: NewsletterList) {
    const memberCountRows = await NewsletterListMember.query()
      .where('list_id', list.id)
      .count('* as total')
    const memberCount = Number((memberCountRows[0] as any).$extras?.total ?? 0)

    const optedOutRow = await db
      .from('escalated_newsletter_list_members as m')
      .innerJoin('escalated_contacts as c', 'c.id', 'm.contact_id')
      .where('m.list_id', list.id)
      .whereNotNull('c.marketing_opt_out_at')
      .count('* as total')
      .first()

    return {
      ...list.serialize(),
      member_count: memberCount,
      opted_out_count: Number(optedOutRow?.total ?? 0),
    }
  }

  private handleValidation(ctx: HttpContext, error: unknown) {
    if (error instanceof NewsletterValidationError) {
      ctx.session.flash('errors', error.errors)
      return ctx.response.redirect().back()
    }
    throw error
  }
}
