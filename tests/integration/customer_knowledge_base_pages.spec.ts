import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Customer knowledge base pages
|--------------------------------------------------------------------------
|
| Admins could write articles, and the widget served them, but a signed-in
| customer had no page to read them on. These render the shared
| Customer/KnowledgeBase/Index and Article pages with the props
| escalated-laravel's Customer\KnowledgeBaseController passes, behind the same
| knowledge_base_enabled / knowledge_base_public / feedback settings.
|
*/

const KB = '/support/kb'

test.group('Customer knowledge base pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })
    await running.db.from('escalated_articles').delete()
    await running.db.from('escalated_article_categories').delete()
    await running.db
      .from('escalated_settings')
      .whereIn('key', [
        'knowledge_base_enabled',
        'knowledge_base_public',
        'knowledge_base_feedback_enabled',
      ])
      .delete()
    await setting('knowledge_base_enabled', '1')
  })

  group.each.timeout(30_000)

  async function setting(key: string, value: string) {
    await running.db.from('escalated_settings').where('key', key).delete()
    await running.db.table('escalated_settings').insert({
      key,
      value,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
  }

  async function category(name: string, slug: string, parentId: number | null = null) {
    const [id] = await running.db.table('escalated_article_categories').insert({
      name,
      slug,
      parent_id: parentId,
      position: 0,
      description: `${name} articles`,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    return Number(id)
  }

  async function article(
    title: string,
    slug: string,
    categoryId: number | null,
    status = 'published',
    body = `<p>${title} body</p>`
  ) {
    const [id] = await running.db.table('escalated_articles').insert({
      title,
      slug,
      body,
      status,
      category_id: categoryId,
      view_count: 3,
      published_at: status === 'published' ? sqlTimestamp() : null,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    return Number(id)
  }

  test('index renders the published articles, root categories and filters', async ({ assert }) => {
    const billing = await category('Billing', 'billing')
    await category('Refunds', 'refunds', billing)
    await article('Pay an invoice', 'pay-an-invoice', billing)
    await article('Draft piece', 'draft-piece', billing, 'draft')

    const visit = await client.visit('GET', KB)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Customer/KnowledgeBase/Index')
    const { categories, articles, filters, feedbackEnabled } = visit.body.props

    assert.lengthOf(categories, 1, 'only root categories')
    assert.equal(categories[0].id, billing)
    assert.equal(categories[0].name, 'Billing')
    assert.equal(categories[0].description, 'Billing articles')
    assert.equal(categories[0].articles_count, 1, 'counts published articles only')

    assert.lengthOf(articles.data, 1)
    const [row] = articles.data
    assert.equal(row.title, 'Pay an invoice')
    assert.equal(row.slug, 'pay-an-invoice')
    assert.equal(row.view_count, 3)
    assert.equal(row.category.name, 'Billing')
    assert.isArray(articles.links)
    assert.equal(articles.current_page, 1)
    assert.equal(articles.total, 1)

    assert.deepEqual(filters, {})
    assert.isTrue(feedbackEnabled)
  })

  test('index filters by search and category and echoes the filters', async ({ assert }) => {
    const billing = await category('Billing', 'billing')
    const account = await category('Account', 'account')
    await article('Pay an invoice', 'pay-an-invoice', billing)
    await article('Reset password', 'reset-password', account)

    const searched = await client.visit('GET', `${KB}?search=password`)
    assert.deepEqual(
      searched.body.props.articles.data.map((a: any) => a.slug),
      ['reset-password']
    )
    assert.deepEqual(searched.body.props.filters, { search: 'password' })

    const filtered = await client.visit('GET', `${KB}?category=${billing}`)
    assert.deepEqual(
      filtered.body.props.articles.data.map((a: any) => a.slug),
      ['pay-an-invoice']
    )
    assert.deepEqual(filtered.body.props.filters, { category: String(billing) })
  })

  test('article renders the article, related articles and counts the view', async ({ assert }) => {
    const billing = await category('Billing', 'billing')
    const id = await article('Pay an invoice', 'pay-an-invoice', billing)
    await article('Update a card', 'update-a-card', billing)
    await article('Hidden draft', 'hidden-draft', billing, 'draft')

    const visit = await client.visit('GET', `${KB}/pay-an-invoice`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Customer/KnowledgeBase/Article')
    const { article: shown, related, feedbackEnabled } = visit.body.props
    assert.equal(shown.id, id)
    assert.equal(shown.title, 'Pay an invoice')
    assert.equal(shown.slug, 'pay-an-invoice')
    assert.equal(shown.body, '<p>Pay an invoice body</p>')
    assert.equal(shown.view_count, 4)
    assert.isString(shown.published_at)
    assert.equal(shown.category.id, billing)
    assert.equal(shown.category.name, 'Billing')
    assert.deepEqual(related, [{ id: id + 1, title: 'Update a card', slug: 'update-a-card' }])
    assert.isTrue(feedbackEnabled)

    const row = await running.db.from('escalated_articles').where('id', id).first()
    assert.equal(Number(row.view_count), 4)
  })

  test('a draft or unknown article is a 404', async ({ assert }) => {
    await article('Hidden draft', 'hidden-draft', null, 'draft')

    const draft = await client.visit('GET', `${KB}/hidden-draft`)
    const unknown = await client.visit('GET', `${KB}/nope`)
    assert.equal(draft.status, 404)
    assert.equal(unknown.status, 404)
  })

  test('feedback counts a helpful and a not helpful vote', async ({ assert }) => {
    const id = await article('Pay an invoice', 'pay-an-invoice', null)

    const yes = await client.visit('POST', `${KB}/pay-an-invoice/feedback`, {
      data: { helpful: true },
      referer: `${KB}/pay-an-invoice`,
    })
    assert.equal(yes.status, 302, JSON.stringify(yes.body))
    assert.equal(yes.location, `${KB}/pay-an-invoice`)
    await client.visit('POST', `${KB}/pay-an-invoice/feedback`, {
      data: { helpful: false },
      referer: `${KB}/pay-an-invoice`,
    })

    const row = await running.db.from('escalated_articles').where('id', id).first()
    assert.equal(Number(row.helpful_count), 1)
    assert.equal(Number(row.not_helpful_count), 1)
  })

  test('feedback is a 404 when feedback is turned off, and the pages say so', async ({
    assert,
  }) => {
    await setting('knowledge_base_feedback_enabled', '0')
    const id = await article('Pay an invoice', 'pay-an-invoice', null)

    const page = await client.visit('GET', `${KB}/pay-an-invoice`)
    assert.isFalse(page.body.props.feedbackEnabled)

    const visit = await client.visit('POST', `${KB}/pay-an-invoice/feedback`, {
      data: { helpful: true },
    })
    assert.equal(visit.status, 404)
    const row = await running.db.from('escalated_articles').where('id', id).first()
    assert.equal(Number(row.helpful_count), 0)
  })

  test('feedback without a helpful answer is refused', async ({ assert }) => {
    const id = await article('Pay an invoice', 'pay-an-invoice', null)

    const visit = await client.visit('POST', `${KB}/pay-an-invoice/feedback`, {
      data: {},
      referer: `${KB}/pay-an-invoice`,
    })
    assert.equal(visit.status, 302)
    const row = await running.db.from('escalated_articles').where('id', id).first()
    assert.equal(Number(row.helpful_count) + Number(row.not_helpful_count), 0)
  })

  test('the pages are a 404 while the knowledge base is off', async ({ assert }) => {
    await setting('knowledge_base_enabled', '0')
    await article('Pay an invoice', 'pay-an-invoice', null)

    const index = await client.visit('GET', KB)
    const shown = await client.visit('GET', `${KB}/pay-an-invoice`)
    assert.equal(index.status, 404)
    assert.equal(shown.status, 404)
  })
})
