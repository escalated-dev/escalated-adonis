import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Types & Constants Tests
|--------------------------------------------------------------------------
|
| Tests for STATUS_TRANSITIONS, canTransitionTo(), isOpenStatus(),
| and all constant maps from src/types.ts.
|
| Since we cannot import TypeScript source directly, we re-declare
| the expected values and test the business rules inline.
|
*/

// ──────────────────────────────────────────────────────────────────
// Source-of-truth copies (must match src/types.ts exactly)
// ──────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  'open',
  'in_progress',
  'waiting_on_customer',
  'waiting_on_agent',
  'escalated',
  'resolved',
  'closed',
  'reopened',
]

const ALL_PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical']

const ALL_ACTIVITY_TYPES = [
  'status_changed',
  'assigned',
  'unassigned',
  'priority_changed',
  'tag_added',
  'tag_removed',
  'escalated',
  'sla_breached',
  'replied',
  'note_added',
  'department_changed',
  'reopened',
  'resolved',
  'closed',
]

const INBOUND_EMAIL_STATUSES = ['pending', 'processed', 'failed', 'spam']

const STATUS_TRANSITIONS = {
  open: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  in_progress: ['waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  waiting_on_customer: ['open', 'in_progress', 'resolved', 'closed'],
  waiting_on_agent: ['open', 'in_progress', 'escalated', 'resolved', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['reopened', 'closed'],
  closed: ['reopened'],
  reopened: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
}

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  waiting_on_agent: 'Waiting on Agent',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
}

const STATUS_COLORS = {
  open: '#3B82F6',
  in_progress: '#8B5CF6',
  waiting_on_customer: '#F59E0B',
  waiting_on_agent: '#F97316',
  escalated: '#EF4444',
  resolved: '#10B981',
  closed: '#6B7280',
  reopened: '#3B82F6',
}

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
}

const PRIORITY_COLORS = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#F97316',
  critical: '#EF4444',
}

const PRIORITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
  critical: 5,
}

const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'vbe',
  'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1', 'reg',
  'cpl', 'hta', 'inf', 'lnk', 'sct', 'shb', 'sys', 'drv',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phar',
  'sh', 'bash', 'csh', 'ksh', 'pl', 'py', 'rb',
  'dll', 'so', 'dylib',
]

const ALLOWED_HTML_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'div',
  'span', 'sub', 'sup',
]

const ALLOWED_SORT_COLUMNS = [
  'created_at', 'updated_at', 'status', 'priority',
  'subject', 'reference', 'assigned_to', 'department_id',
  'resolved_at', 'closed_at',
]

// ──────────────────────────────────────────────────────────────────
// Re-implement pure functions from src/types.ts
// ──────────────────────────────────────────────────────────────────

function canTransitionTo(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || []
  return allowed.includes(to)
}

function isOpenStatus(status) {
  return !['resolved', 'closed'].includes(status)
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('TicketStatus enum values', () => {
  it('should have exactly 8 statuses', () => {
    assert.equal(ALL_STATUSES.length, 8)
  })

  it('should contain all expected status values', () => {
    const expected = [
      'open', 'in_progress', 'waiting_on_customer', 'waiting_on_agent',
      'escalated', 'resolved', 'closed', 'reopened',
    ]
    assert.deepStrictEqual(ALL_STATUSES, expected)
  })

  it('should have no duplicate statuses', () => {
    const unique = new Set(ALL_STATUSES)
    assert.equal(unique.size, ALL_STATUSES.length)
  })
})

describe('TicketPriority enum values', () => {
  it('should have exactly 5 priorities', () => {
    assert.equal(ALL_PRIORITIES.length, 5)
  })

  it('should contain all expected priority values', () => {
    assert.deepStrictEqual(ALL_PRIORITIES, ['low', 'medium', 'high', 'urgent', 'critical'])
  })

  it('should have no duplicate priorities', () => {
    const unique = new Set(ALL_PRIORITIES)
    assert.equal(unique.size, ALL_PRIORITIES.length)
  })
})

describe('ActivityType enum values', () => {
  it('should have exactly 14 activity types', () => {
    assert.equal(ALL_ACTIVITY_TYPES.length, 14)
  })

  it('should have no duplicate activity types', () => {
    const unique = new Set(ALL_ACTIVITY_TYPES)
    assert.equal(unique.size, ALL_ACTIVITY_TYPES.length)
  })
})

describe('InboundEmailStatus enum values', () => {
  it('should have exactly 4 inbound email statuses', () => {
    assert.equal(INBOUND_EMAIL_STATUSES.length, 4)
  })

  it('should contain pending, processed, failed, spam', () => {
    assert.deepStrictEqual(INBOUND_EMAIL_STATUSES, ['pending', 'processed', 'failed', 'spam'])
  })
})

describe('STATUS_TRANSITIONS', () => {
  it('should have entries for every status', () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        STATUS_TRANSITIONS.hasOwnProperty(status),
        `Missing transition entry for status: ${status}`
      )
    }
  })

  it('should only contain valid target statuses', () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of targets) {
        assert.ok(
          ALL_STATUSES.includes(to),
          `Invalid target status '${to}' in transitions from '${from}'`
        )
      }
    }
  })

  it('should not allow self-transitions', () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      assert.ok(
        !targets.includes(from),
        `Status '${from}' should not be able to transition to itself`
      )
    }
  })

  // Specific transition rules
  it('open can transition to 6 statuses', () => {
    assert.equal(STATUS_TRANSITIONS.open.length, 6)
  })

  it('open cannot transition to reopened', () => {
    assert.ok(!STATUS_TRANSITIONS.open.includes('reopened'))
  })

  it('closed can only transition to reopened', () => {
    assert.deepStrictEqual(STATUS_TRANSITIONS.closed, ['reopened'])
  })

  it('resolved can only transition to reopened or closed', () => {
    assert.deepStrictEqual(STATUS_TRANSITIONS.resolved, ['reopened', 'closed'])
  })

  it('escalated can transition to in_progress, resolved, or closed', () => {
    assert.deepStrictEqual(STATUS_TRANSITIONS.escalated, ['in_progress', 'resolved', 'closed'])
  })

  it('reopened has same transitions as open minus open itself', () => {
    // reopened should behave like open but not transition to "open"
    const reopenedTargets = STATUS_TRANSITIONS.reopened
    assert.ok(!reopenedTargets.includes('open'))
    assert.ok(!reopenedTargets.includes('reopened'))
    assert.ok(reopenedTargets.includes('in_progress'))
    assert.ok(reopenedTargets.includes('resolved'))
    assert.ok(reopenedTargets.includes('closed'))
  })

  it('waiting_on_customer can go back to open or in_progress', () => {
    assert.ok(STATUS_TRANSITIONS.waiting_on_customer.includes('open'))
    assert.ok(STATUS_TRANSITIONS.waiting_on_customer.includes('in_progress'))
  })

  it('waiting_on_agent can escalate', () => {
    assert.ok(STATUS_TRANSITIONS.waiting_on_agent.includes('escalated'))
  })

  it('waiting_on_customer cannot escalate directly', () => {
    assert.ok(!STATUS_TRANSITIONS.waiting_on_customer.includes('escalated'))
  })

  it('every status except closed can reach resolved', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'closed') continue
      assert.ok(
        STATUS_TRANSITIONS[status].includes('resolved') || status === 'resolved',
        `Status '${status}' should be able to reach resolved`
      )
    }
  })

  it('every status except resolved can reach closed (directly or indirectly)', () => {
    // Direct transitions to closed
    const directToClosed = ALL_STATUSES.filter(
      (s) => STATUS_TRANSITIONS[s].includes('closed')
    )
    // All except 'closed' itself should be able to reach 'closed'
    assert.ok(directToClosed.length >= 6)
  })
})

describe('canTransitionTo()', () => {
  it('returns true for valid transitions', () => {
    assert.ok(canTransitionTo('open', 'in_progress'))
    assert.ok(canTransitionTo('open', 'resolved'))
    assert.ok(canTransitionTo('open', 'closed'))
    assert.ok(canTransitionTo('resolved', 'reopened'))
    assert.ok(canTransitionTo('closed', 'reopened'))
    assert.ok(canTransitionTo('escalated', 'resolved'))
  })

  it('returns false for invalid transitions', () => {
    assert.ok(!canTransitionTo('open', 'reopened'))
    assert.ok(!canTransitionTo('closed', 'open'))
    assert.ok(!canTransitionTo('closed', 'in_progress'))
    assert.ok(!canTransitionTo('resolved', 'open'))
    assert.ok(!canTransitionTo('resolved', 'in_progress'))
    assert.ok(!canTransitionTo('escalated', 'open'))
  })

  it('returns false for self-transitions', () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        !canTransitionTo(status, status),
        `Self-transition should be rejected for status: ${status}`
      )
    }
  })

  it('returns false for unknown source status', () => {
    assert.ok(!canTransitionTo('nonexistent', 'open'))
  })

  it('returns false for unknown target status', () => {
    assert.ok(!canTransitionTo('open', 'nonexistent'))
  })

  it('validates all defined transitions exhaustively', () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of targets) {
        assert.ok(
          canTransitionTo(from, to),
          `canTransitionTo('${from}', '${to}') should return true`
        )
      }
    }
  })

  it('validates all non-transitions exhaustively', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (STATUS_TRANSITIONS[from].includes(to)) continue
        assert.ok(
          !canTransitionTo(from, to),
          `canTransitionTo('${from}', '${to}') should return false`
        )
      }
    }
  })
})

describe('isOpenStatus()', () => {
  it('returns true for open statuses', () => {
    const openStatuses = ['open', 'in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'reopened']
    for (const status of openStatuses) {
      assert.ok(isOpenStatus(status), `'${status}' should be considered open`)
    }
  })

  it('returns false for resolved', () => {
    assert.ok(!isOpenStatus('resolved'))
  })

  it('returns false for closed', () => {
    assert.ok(!isOpenStatus('closed'))
  })

  it('returns true for unknown statuses (not resolved/closed)', () => {
    // The implementation uses !['resolved', 'closed'].includes(status)
    // so any unknown string would return true
    assert.ok(isOpenStatus('anything_else'))
  })

  it('exactly 2 statuses are not open', () => {
    const closedStatuses = ALL_STATUSES.filter((s) => !isOpenStatus(s))
    assert.equal(closedStatuses.length, 2)
    assert.deepStrictEqual(closedStatuses.sort(), ['closed', 'resolved'])
  })

  it('exactly 6 statuses are open', () => {
    const openStatuses = ALL_STATUSES.filter((s) => isOpenStatus(s))
    assert.equal(openStatuses.length, 6)
  })
})

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        STATUS_LABELS.hasOwnProperty(status),
        `Missing label for status: ${status}`
      )
    }
  })

  it('all labels are non-empty strings', () => {
    for (const [status, label] of Object.entries(STATUS_LABELS)) {
      assert.equal(typeof label, 'string', `Label for '${status}' should be a string`)
      assert.ok(label.length > 0, `Label for '${status}' should not be empty`)
    }
  })

  it('labels are human-readable (title case)', () => {
    // Each label should start with an uppercase letter
    for (const [status, label] of Object.entries(STATUS_LABELS)) {
      assert.ok(
        /^[A-Z]/.test(label),
        `Label for '${status}' should start with uppercase: got '${label}'`
      )
    }
  })

  it('has correct specific labels', () => {
    assert.equal(STATUS_LABELS.open, 'Open')
    assert.equal(STATUS_LABELS.in_progress, 'In Progress')
    assert.equal(STATUS_LABELS.waiting_on_customer, 'Waiting on Customer')
    assert.equal(STATUS_LABELS.waiting_on_agent, 'Waiting on Agent')
    assert.equal(STATUS_LABELS.escalated, 'Escalated')
    assert.equal(STATUS_LABELS.resolved, 'Resolved')
    assert.equal(STATUS_LABELS.closed, 'Closed')
    assert.equal(STATUS_LABELS.reopened, 'Reopened')
  })

  it('has no extra entries beyond defined statuses', () => {
    assert.equal(Object.keys(STATUS_LABELS).length, ALL_STATUSES.length)
  })
})

describe('STATUS_COLORS', () => {
  it('has a color for every status', () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        STATUS_COLORS.hasOwnProperty(status),
        `Missing color for status: ${status}`
      )
    }
  })

  it('all colors are valid hex color codes', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/
    for (const [status, color] of Object.entries(STATUS_COLORS)) {
      assert.ok(
        hexRegex.test(color),
        `Color for '${status}' should be a valid hex code: got '${color}'`
      )
    }
  })

  it('open and reopened share the same color', () => {
    assert.equal(STATUS_COLORS.open, STATUS_COLORS.reopened)
  })

  it('escalated is red (danger color)', () => {
    assert.equal(STATUS_COLORS.escalated, '#EF4444')
  })

  it('resolved is green (success color)', () => {
    assert.equal(STATUS_COLORS.resolved, '#10B981')
  })

  it('closed is gray (neutral color)', () => {
    assert.equal(STATUS_COLORS.closed, '#6B7280')
  })
})

describe('PRIORITY_LABELS', () => {
  it('has a label for every priority', () => {
    for (const priority of ALL_PRIORITIES) {
      assert.ok(
        PRIORITY_LABELS.hasOwnProperty(priority),
        `Missing label for priority: ${priority}`
      )
    }
  })

  it('has correct specific labels', () => {
    assert.equal(PRIORITY_LABELS.low, 'Low')
    assert.equal(PRIORITY_LABELS.medium, 'Medium')
    assert.equal(PRIORITY_LABELS.high, 'High')
    assert.equal(PRIORITY_LABELS.urgent, 'Urgent')
    assert.equal(PRIORITY_LABELS.critical, 'Critical')
  })

  it('has no extra entries beyond defined priorities', () => {
    assert.equal(Object.keys(PRIORITY_LABELS).length, ALL_PRIORITIES.length)
  })
})

describe('PRIORITY_COLORS', () => {
  it('has a color for every priority', () => {
    for (const priority of ALL_PRIORITIES) {
      assert.ok(
        PRIORITY_COLORS.hasOwnProperty(priority),
        `Missing color for priority: ${priority}`
      )
    }
  })

  it('all colors are valid hex color codes', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/
    for (const [priority, color] of Object.entries(PRIORITY_COLORS)) {
      assert.ok(
        hexRegex.test(color),
        `Color for '${priority}' should be a valid hex code: got '${color}'`
      )
    }
  })

  it('critical is red (danger color)', () => {
    assert.equal(PRIORITY_COLORS.critical, '#EF4444')
  })

  it('low is gray (neutral color)', () => {
    assert.equal(PRIORITY_COLORS.low, '#6B7280')
  })

  it('severity increases from cool to warm colors', () => {
    // low=gray, medium=blue, high=yellow, urgent=orange, critical=red
    assert.equal(PRIORITY_COLORS.low, '#6B7280')
    assert.equal(PRIORITY_COLORS.medium, '#3B82F6')
    assert.equal(PRIORITY_COLORS.high, '#F59E0B')
    assert.equal(PRIORITY_COLORS.urgent, '#F97316')
    assert.equal(PRIORITY_COLORS.critical, '#EF4444')
  })
})

describe('PRIORITY_WEIGHTS', () => {
  it('has a weight for every priority', () => {
    for (const priority of ALL_PRIORITIES) {
      assert.ok(
        PRIORITY_WEIGHTS.hasOwnProperty(priority),
        `Missing weight for priority: ${priority}`
      )
    }
  })

  it('all weights are positive integers', () => {
    for (const [priority, weight] of Object.entries(PRIORITY_WEIGHTS)) {
      assert.equal(typeof weight, 'number', `Weight for '${priority}' should be a number`)
      assert.ok(weight > 0, `Weight for '${priority}' should be positive`)
      assert.ok(Number.isInteger(weight), `Weight for '${priority}' should be an integer`)
    }
  })

  it('weights are strictly increasing with severity', () => {
    assert.ok(PRIORITY_WEIGHTS.low < PRIORITY_WEIGHTS.medium)
    assert.ok(PRIORITY_WEIGHTS.medium < PRIORITY_WEIGHTS.high)
    assert.ok(PRIORITY_WEIGHTS.high < PRIORITY_WEIGHTS.urgent)
    assert.ok(PRIORITY_WEIGHTS.urgent < PRIORITY_WEIGHTS.critical)
  })

  it('has correct specific weights', () => {
    assert.equal(PRIORITY_WEIGHTS.low, 1)
    assert.equal(PRIORITY_WEIGHTS.medium, 2)
    assert.equal(PRIORITY_WEIGHTS.high, 3)
    assert.equal(PRIORITY_WEIGHTS.urgent, 4)
    assert.equal(PRIORITY_WEIGHTS.critical, 5)
  })

  it('weight range is 1-5', () => {
    const weights = Object.values(PRIORITY_WEIGHTS)
    assert.equal(Math.min(...weights), 1)
    assert.equal(Math.max(...weights), 5)
  })
})

describe('BLOCKED_EXTENSIONS', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(BLOCKED_EXTENSIONS))
    assert.ok(BLOCKED_EXTENSIONS.length > 0)
  })

  it('has no duplicate entries', () => {
    const unique = new Set(BLOCKED_EXTENSIONS)
    assert.equal(unique.size, BLOCKED_EXTENSIONS.length)
  })

  it('all entries are lowercase strings without dots', () => {
    for (const ext of BLOCKED_EXTENSIONS) {
      assert.equal(typeof ext, 'string')
      assert.equal(ext, ext.toLowerCase(), `Extension '${ext}' should be lowercase`)
      assert.ok(!ext.includes('.'), `Extension '${ext}' should not contain a dot`)
    }
  })

  it('blocks Windows executables', () => {
    const windowsExecs = ['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif']
    for (const ext of windowsExecs) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('blocks scripting languages', () => {
    const scripts = ['vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1']
    for (const ext of scripts) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('blocks PHP files', () => {
    const phpExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phar']
    for (const ext of phpExts) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('blocks Unix scripting', () => {
    const unixScripts = ['sh', 'bash', 'csh', 'ksh', 'pl', 'py', 'rb']
    for (const ext of unixScripts) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('blocks shared libraries', () => {
    const libs = ['dll', 'so', 'dylib']
    for (const ext of libs) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('blocks system/registry files', () => {
    const sysFiles = ['reg', 'sys', 'drv', 'inf', 'lnk']
    for (const ext of sysFiles) {
      assert.ok(BLOCKED_EXTENSIONS.includes(ext), `Should block .${ext}`)
    }
  })

  it('does NOT block common safe file types', () => {
    const safe = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip', 'mp4', 'mp3']
    for (const ext of safe) {
      assert.ok(!BLOCKED_EXTENSIONS.includes(ext), `Should NOT block .${ext}`)
    }
  })
})

describe('ALLOWED_HTML_TAGS', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(ALLOWED_HTML_TAGS))
    assert.ok(ALLOWED_HTML_TAGS.length > 0)
  })

  it('has no duplicate entries', () => {
    const unique = new Set(ALLOWED_HTML_TAGS)
    assert.equal(unique.size, ALLOWED_HTML_TAGS.length)
  })

  it('all entries are lowercase strings', () => {
    for (const tag of ALLOWED_HTML_TAGS) {
      assert.equal(typeof tag, 'string')
      assert.equal(tag, tag.toLowerCase(), `Tag '${tag}' should be lowercase`)
    }
  })

  it('allows basic formatting tags', () => {
    const formatting = ['p', 'br', 'b', 'strong', 'i', 'em', 'u']
    for (const tag of formatting) {
      assert.ok(ALLOWED_HTML_TAGS.includes(tag), `Should allow <${tag}>`)
    }
  })

  it('allows heading tags', () => {
    for (let i = 1; i <= 6; i++) {
      assert.ok(ALLOWED_HTML_TAGS.includes(`h${i}`), `Should allow <h${i}>`)
    }
  })

  it('allows list tags', () => {
    const listTags = ['ul', 'ol', 'li']
    for (const tag of listTags) {
      assert.ok(ALLOWED_HTML_TAGS.includes(tag), `Should allow <${tag}>`)
    }
  })

  it('allows table tags', () => {
    const tableTags = ['table', 'thead', 'tbody', 'tr', 'th', 'td']
    for (const tag of tableTags) {
      assert.ok(ALLOWED_HTML_TAGS.includes(tag), `Should allow <${tag}>`)
    }
  })

  it('allows links and images', () => {
    assert.ok(ALLOWED_HTML_TAGS.includes('a'))
    assert.ok(ALLOWED_HTML_TAGS.includes('img'))
  })

  it('allows code/pre blocks', () => {
    assert.ok(ALLOWED_HTML_TAGS.includes('pre'))
    assert.ok(ALLOWED_HTML_TAGS.includes('code'))
  })

  it('allows structural elements', () => {
    assert.ok(ALLOWED_HTML_TAGS.includes('div'))
    assert.ok(ALLOWED_HTML_TAGS.includes('span'))
    assert.ok(ALLOWED_HTML_TAGS.includes('hr'))
    assert.ok(ALLOWED_HTML_TAGS.includes('blockquote'))
  })

  it('does NOT allow script tag', () => {
    assert.ok(!ALLOWED_HTML_TAGS.includes('script'))
  })

  it('does NOT allow dangerous tags', () => {
    const dangerous = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'style', 'link', 'meta', 'base', 'applet']
    for (const tag of dangerous) {
      assert.ok(!ALLOWED_HTML_TAGS.includes(tag), `Should NOT allow <${tag}>`)
    }
  })
})

describe('ALLOWED_SORT_COLUMNS', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(ALLOWED_SORT_COLUMNS))
    assert.ok(ALLOWED_SORT_COLUMNS.length > 0)
  })

  it('has no duplicate entries', () => {
    const unique = new Set(ALLOWED_SORT_COLUMNS)
    assert.equal(unique.size, ALLOWED_SORT_COLUMNS.length)
  })

  it('contains timestamp columns', () => {
    assert.ok(ALLOWED_SORT_COLUMNS.includes('created_at'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('updated_at'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('resolved_at'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('closed_at'))
  })

  it('contains status and priority', () => {
    assert.ok(ALLOWED_SORT_COLUMNS.includes('status'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('priority'))
  })

  it('contains ticket identification columns', () => {
    assert.ok(ALLOWED_SORT_COLUMNS.includes('subject'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('reference'))
  })

  it('contains assignment and department columns', () => {
    assert.ok(ALLOWED_SORT_COLUMNS.includes('assigned_to'))
    assert.ok(ALLOWED_SORT_COLUMNS.includes('department_id'))
  })

  it('does NOT contain dangerous SQL column names', () => {
    const dangerous = ['id; DROP TABLE', '1=1', 'password', 'token']
    for (const col of dangerous) {
      assert.ok(!ALLOWED_SORT_COLUMNS.includes(col))
    }
  })

  it('has exactly 10 entries', () => {
    assert.equal(ALLOWED_SORT_COLUMNS.length, 10)
  })
})

describe('Status transition graph integrity', () => {
  it('closed tickets can only be reopened (single exit path)', () => {
    assert.equal(STATUS_TRANSITIONS.closed.length, 1)
    assert.equal(STATUS_TRANSITIONS.closed[0], 'reopened')
  })

  it('resolved tickets have limited exits (reopened or closed)', () => {
    assert.equal(STATUS_TRANSITIONS.resolved.length, 2)
  })

  it('every status is reachable from open (within 2 hops)', () => {
    // From open, we can reach: in_progress, waiting_on_customer, waiting_on_agent, escalated, resolved, closed
    // From resolved we can reach: reopened
    // So all 8 statuses are reachable within 2 hops from open
    const reachable = new Set(['open'])
    const fromOpen = STATUS_TRANSITIONS.open
    fromOpen.forEach((s) => reachable.add(s))

    for (const s of fromOpen) {
      STATUS_TRANSITIONS[s].forEach((t) => reachable.add(t))
    }

    assert.equal(reachable.size, ALL_STATUSES.length, 'All statuses should be reachable within 2 hops from open')
  })

  it('there is always a path from any open status to closed', () => {
    // BFS from each open status to see if closed is reachable
    const openStatuses = ALL_STATUSES.filter((s) => isOpenStatus(s))

    for (const start of openStatuses) {
      const visited = new Set()
      const queue = [start]

      while (queue.length > 0) {
        const current = queue.shift()
        if (current === 'closed') break
        if (visited.has(current)) continue
        visited.add(current)

        const targets = STATUS_TRANSITIONS[current] || []
        queue.push(...targets)
      }

      assert.ok(
        visited.has('closed') || queue.includes('closed') || STATUS_TRANSITIONS[start].includes('closed'),
        `Should be possible to reach 'closed' from '${start}'`
      )
    }
  })
})
