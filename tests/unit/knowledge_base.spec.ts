import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARTICLE_STATUSES,
  DRAFT_STATUS,
  PUBLISHED_STATUS,
  articleMatchesSearch,
  findPublishedBySlug,
  isPublished,
  normalizeStatus,
  resolveSlug,
  selectPublicArticles,
  shouldSetPublishedAt,
} from '../../src/support/knowledge_base.ts'

/*
|--------------------------------------------------------------------------
| Knowledge Base authoring — pure decision logic
|--------------------------------------------------------------------------
|
| Exercises the exported helpers that both the admin controllers and the
| public widget read path use. No Lucid / no HTTP: the rules that govern
| slug generation, publish semantics, and the public read surface are pure
| and tested directly.
|
*/

describe('knowledge base — status', () => {
  it('exposes exactly draft and published', () => {
    assert.deepEqual([...ARTICLE_STATUSES], ['draft', 'published'])
    assert.equal(DRAFT_STATUS, 'draft')
    assert.equal(PUBLISHED_STATUS, 'published')
  })

  it('normalizes an unknown status to draft', () => {
    assert.equal(normalizeStatus('published'), 'published')
    assert.equal(normalizeStatus('draft'), 'draft')
    assert.equal(normalizeStatus('archived'), 'draft')
    assert.equal(normalizeStatus(undefined), 'draft')
    assert.equal(normalizeStatus(''), 'draft')
  })
})

describe('knowledge base — resolveSlug', () => {
  it('slugifies the source when no explicit slug is given', () => {
    assert.equal(resolveSlug(null, 'How To Reset Your Password'), 'how-to-reset-your-password')
    assert.equal(resolveSlug('', 'Getting Started'), 'getting-started')
    assert.equal(resolveSlug(undefined, 'Billing & Invoices'), 'billing-and-invoices')
  })

  it('prefers an explicit slug, normalized', () => {
    assert.equal(resolveSlug('Custom Slug', 'Ignored Title'), 'custom-slug')
    assert.equal(resolveSlug('  spaced-out  ', 'Ignored'), 'spaced-out')
  })
})

describe('knowledge base — shouldSetPublishedAt', () => {
  it('stamps published_at the first time an article is published', () => {
    assert.equal(shouldSetPublishedAt('published', null), true)
    assert.equal(shouldSetPublishedAt('published', undefined), true)
  })

  it('does not re-stamp an already-published article', () => {
    assert.equal(shouldSetPublishedAt('published', '2026-01-01T00:00:00Z'), false)
  })

  it('never stamps a draft', () => {
    assert.equal(shouldSetPublishedAt('draft', null), false)
    assert.equal(shouldSetPublishedAt('draft', '2026-01-01T00:00:00Z'), false)
  })
})

describe('knowledge base — public read surface', () => {
  // Simulate what an admin authored: two published, one draft, across categories.
  const authored = [
    {
      id: 1,
      slug: 'reset-password',
      title: 'Reset password',
      body: 'Click forgot password',
      status: 'published',
      categoryId: 10,
    },
    {
      id: 2,
      slug: 'billing-cycle',
      title: 'Billing cycle',
      body: 'We bill monthly',
      status: 'published',
      categoryId: 20,
    },
    {
      id: 3,
      slug: 'secret-draft',
      title: 'Secret draft',
      body: 'Unfinished',
      status: 'draft',
      categoryId: 10,
    },
  ]

  it('is published only when status is published', () => {
    assert.equal(isPublished(authored[0]), true)
    assert.equal(isPublished(authored[2]), false)
  })

  it('admin-created published articles appear in the public list', () => {
    const list = selectPublicArticles(authored)
    assert.deepEqual(
      list.map((a) => a.id),
      [1, 2]
    )
  })

  it('excludes unpublished (draft) articles from the public list', () => {
    const list = selectPublicArticles(authored)
    assert.ok(!list.some((a) => a.status === 'draft'))
    assert.ok(!list.some((a) => a.slug === 'secret-draft'))
  })

  it('honors category assignment when filtering', () => {
    const list = selectPublicArticles(authored, { categoryId: 20 })
    assert.deepEqual(
      list.map((a) => a.id),
      [2]
    )
    // A draft in category 10 must still be excluded even when its category is selected.
    assert.deepEqual(
      selectPublicArticles(authored, { categoryId: 10 }).map((a) => a.id),
      [1]
    )
  })

  it('supports case-insensitive search over title and body', () => {
    assert.equal(articleMatchesSearch(authored[0], 'RESET'), true)
    assert.equal(articleMatchesSearch(authored[0], 'forgot'), true)
    assert.equal(articleMatchesSearch(authored[0], 'nonsense'), false)
    assert.equal(articleMatchesSearch(authored[0], ''), true)

    const searched = selectPublicArticles(authored, { search: 'bill' })
    assert.deepEqual(
      searched.map((a) => a.id),
      [2]
    )
  })

  it('resolves a published article by slug for the public show route', () => {
    const found = findPublishedBySlug(authored, 'reset-password')
    assert.ok(found)
    assert.equal(found?.id, 1)
  })

  it('does not resolve a draft article by slug (public show 404)', () => {
    assert.equal(findPublishedBySlug(authored, 'secret-draft'), undefined)
    assert.equal(findPublishedBySlug(authored, 'does-not-exist'), undefined)
  })
})
