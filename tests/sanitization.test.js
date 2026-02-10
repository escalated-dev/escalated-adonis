import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Sanitization & Email Processing Tests
|--------------------------------------------------------------------------
|
| Tests for the HTML sanitization logic and email processing helpers
| from InboundEmailService (src/services/inbound_email_service.ts).
|
| These are pure string-processing functions extracted and re-implemented
| here for testing without AdonisJS dependencies.
|
*/

// ──────────────────────────────────────────────────────────────────
// Source-of-truth copies (must match src/types.ts)
// ──────────────────────────────────────────────────────────────────

const ALLOWED_HTML_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'div',
  'span', 'sub', 'sup',
]

const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'vbe',
  'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1', 'reg',
  'cpl', 'hta', 'inf', 'lnk', 'sct', 'shb', 'sys', 'drv',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phar',
  'sh', 'bash', 'csh', 'ksh', 'pl', 'py', 'rb',
  'dll', 'so', 'dylib',
]

// ──────────────────────────────────────────────────────────────────
// Re-implement pure functions from InboundEmailService
// ──────────────────────────────────────────────────────────────────

/**
 * Sanitize HTML content (from inbound_email_service.ts sanitizeHtml)
 */
function sanitizeHtml(html) {
  if (!html || !html.trim()) return html

  // Build a regex to strip non-allowed tags
  const tagPattern = ALLOWED_HTML_TAGS.join('|')
  const stripRegex = new RegExp(`<(?!\\/?(${tagPattern})(\\s|>|\\/))\\/?[^>]*>`, 'gi')
  let clean = html.replace(stripRegex, '')

  // Remove event handlers
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  clean = clean.replace(/\s+on\w+\s*=\s*\S+/gi, '')

  // Remove javascript: protocol
  clean = clean.replace(/\b(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi, '$1="')

  // Remove dangerous data: URLs (allow data:image)
  clean = clean.replace(/\b(href|src|action)\s*=\s*["']?\s*data\s*:(?!image\/)/gi, '$1="')

  // Remove CSS expressions
  clean = clean.replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '')
  clean = clean.replace(/style\s*=\s*["'][^"']*url\s*\(\s*["']?\s*javascript:[^"']*["']/gi, '')

  return clean
}

/**
 * Sanitize email subject (from inbound_email_service.ts sanitizeSubject)
 */
function sanitizeSubject(subject) {
  let cleaned = subject.trim()
  while (/^(RE|FW|FWD)\s*:\s*/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(RE|FW|FWD)\s*:\s*/i, '')
  }

  // Remove ticket reference brackets
  cleaned = cleaned.replace(/\[ESC-\d+\]\s*/g, '')

  return cleaned.trim() || '(No Subject)'
}

/**
 * Derive a display name from an email address
 * (from inbound_email_service.ts nameFromEmail)
 */
function nameFromEmail(email) {
  const local = email.split('@')[0]
  return local
    .replace(/[._\-+]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Get sanitized body from an inbound message
 * (from inbound_email_service.ts getSanitizedBody)
 */
function getSanitizedBody(message) {
  if (message.bodyText) return message.bodyText
  if (message.bodyHtml) return sanitizeHtml(message.bodyHtml) ?? ''
  return ''
}

/**
 * Check if a file extension is blocked
 */
function isBlockedExtension(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return BLOCKED_EXTENSIONS.includes(ext)
}

// ──────────────────────────────────────────────────────────────────
// sanitizeHtml() Tests
// ──────────────────────────────────────────────────────────────────

describe('sanitizeHtml()', () => {
  describe('null/empty handling', () => {
    it('returns null for null input', () => {
      assert.equal(sanitizeHtml(null), null)
    })

    it('returns empty string for empty string', () => {
      assert.equal(sanitizeHtml(''), '')
    })

    it('returns whitespace-only string as-is', () => {
      assert.equal(sanitizeHtml('   '), '   ')
    })

    it('returns undefined for undefined input', () => {
      assert.equal(sanitizeHtml(undefined), undefined)
    })
  })

  describe('preserves allowed tags', () => {
    it('preserves <p> tags', () => {
      const input = '<p>Hello world</p>'
      assert.equal(sanitizeHtml(input), '<p>Hello world</p>')
    })

    it('preserves <br> tags', () => {
      const input = 'Line 1<br>Line 2'
      assert.equal(sanitizeHtml(input), 'Line 1<br>Line 2')
    })

    it('preserves <br/> self-closing tags', () => {
      const input = 'Line 1<br/>Line 2'
      assert.equal(sanitizeHtml(input), 'Line 1<br/>Line 2')
    })

    it('preserves bold tags', () => {
      const input = '<b>bold</b> and <strong>strong</strong>'
      assert.equal(sanitizeHtml(input), '<b>bold</b> and <strong>strong</strong>')
    })

    it('preserves italic tags', () => {
      const input = '<i>italic</i> and <em>emphasized</em>'
      assert.equal(sanitizeHtml(input), '<i>italic</i> and <em>emphasized</em>')
    })

    it('preserves underline tags', () => {
      const input = '<u>underlined</u>'
      assert.equal(sanitizeHtml(input), '<u>underlined</u>')
    })

    it('preserves anchor tags', () => {
      const input = '<a href="https://example.com">link</a>'
      assert.equal(sanitizeHtml(input), '<a href="https://example.com">link</a>')
    })

    it('preserves list tags', () => {
      const input = '<ul><li>one</li><li>two</li></ul>'
      assert.equal(sanitizeHtml(input), '<ul><li>one</li><li>two</li></ul>')
    })

    it('preserves heading tags', () => {
      const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
      assert.equal(sanitizeHtml(input), '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>')
    })

    it('preserves table tags', () => {
      const input = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>'
      assert.equal(sanitizeHtml(input), input)
    })

    it('preserves blockquote and pre/code', () => {
      const input = '<blockquote>quoted</blockquote><pre><code>code</code></pre>'
      assert.equal(sanitizeHtml(input), input)
    })

    it('preserves div and span', () => {
      const input = '<div><span>content</span></div>'
      assert.equal(sanitizeHtml(input), input)
    })

    it('preserves img tags', () => {
      const input = '<img src="photo.jpg" alt="photo">'
      assert.equal(sanitizeHtml(input), input)
    })

    it('preserves hr tags', () => {
      const input = 'above<hr>below'
      assert.equal(sanitizeHtml(input), 'above<hr>below')
    })

    it('preserves sub and sup tags', () => {
      const input = 'H<sub>2</sub>O and x<sup>2</sup>'
      assert.equal(sanitizeHtml(input), input)
    })
  })

  describe('strips dangerous tags', () => {
    it('strips <script> tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<script'))
      assert.ok(!result.includes('</script'))
      assert.ok(result.includes('<p>Hello</p>'))
      assert.ok(result.includes('<p>World</p>'))
    })

    it('strips <iframe> tags', () => {
      const input = '<p>Hello</p><iframe src="https://evil.com"></iframe>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<iframe'))
      assert.ok(!result.includes('</iframe'))
    })

    it('strips <object> tags', () => {
      const input = '<object data="malware.swf"></object>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<object'))
    })

    it('strips <embed> tags', () => {
      const input = '<embed src="malware.swf">'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<embed'))
    })

    it('strips <form> tags', () => {
      const input = '<form action="https://evil.com"><input type="text"></form>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<form'))
      assert.ok(!result.includes('<input'))
    })

    it('strips <style> tags', () => {
      const input = '<style>body { display: none; }</style><p>Content</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<style'))
      assert.ok(result.includes('<p>Content</p>'))
    })

    it('strips <link> tags', () => {
      const input = '<link rel="stylesheet" href="evil.css"><p>Content</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<link'))
    })

    it('strips <meta> tags', () => {
      const input = '<meta http-equiv="refresh" content="0;url=evil.com"><p>Content</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<meta'))
    })

    it('strips <base> tags', () => {
      const input = '<base href="https://evil.com"><a href="/page">link</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<base'))
    })

    it('strips nested dangerous tags', () => {
      const input = '<div><script><script>nested()</script></script></div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<script'))
      assert.ok(result.includes('<div>'))
    })

    it('strips <textarea> and <select> tags', () => {
      const input = '<textarea>content</textarea><select><option>opt</option></select>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<textarea'))
      assert.ok(!result.includes('<select'))
      assert.ok(!result.includes('<option'))
    })
  })

  describe('removes event handlers', () => {
    it('removes onclick with double quotes', () => {
      const input = '<p onclick="alert(1)">text</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onclick'))
      assert.ok(result.includes('<p'))
      assert.ok(result.includes('text'))
    })

    it('removes onclick with single quotes', () => {
      const input = "<p onclick='alert(1)'>text</p>"
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onclick'))
    })

    it('removes onload handler', () => {
      const input = '<img src="photo.jpg" onload="steal()">'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onload'))
    })

    it('removes onerror handler', () => {
      const input = '<img src="x" onerror="alert(1)">'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onerror'))
    })

    it('removes onmouseover handler', () => {
      const input = '<div onmouseover="steal()">hover me</div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onmouseover'))
    })

    it('removes onfocus handler', () => {
      const input = '<div onfocus="alert(1)">text</div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onfocus'))
    })

    it('removes multiple event handlers on same element', () => {
      const input = '<div onclick="a()" onmouseover="b()" onload="c()">text</div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('onclick'))
      assert.ok(!result.includes('onmouseover'))
      assert.ok(!result.includes('onload'))
    })

    it('is case-insensitive for event handler removal', () => {
      const input = '<p ONCLICK="alert(1)" OnLoad="steal()">text</p>'
      const result = sanitizeHtml(input)
      assert.ok(!result.toLowerCase().includes('onclick'))
      assert.ok(!result.toLowerCase().includes('onload'))
    })
  })

  describe('removes javascript: protocol', () => {
    it('removes javascript: from href', () => {
      const input = '<a href="javascript:alert(1)">click</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('javascript:'))
    })

    it('removes javascript: from src', () => {
      const input = '<img src="javascript:alert(1)">'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('javascript:'))
    })

    it('removes javascript: from action', () => {
      // Note: form tag itself will be stripped, but test the protocol removal
      const input = '<a href="javascript:void(0)">link</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('javascript:'))
    })

    it('handles javascript: with whitespace', () => {
      const input = '<a href=" javascript:alert(1)">click</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('javascript:'))
    })

    it('is case-insensitive for javascript: protocol', () => {
      const input = '<a href="JAVASCRIPT:alert(1)">click</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.toLowerCase().includes('javascript:'))
    })
  })

  describe('removes dangerous data: URLs', () => {
    it('removes data:text/html URLs', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('data:text/html'))
    })

    it('preserves data:image URLs', () => {
      const input = '<img src="data:image/png;base64,iVBOR...">'
      const result = sanitizeHtml(input)
      assert.ok(result.includes('data:image/'))
    })

    it('removes data:application URLs', () => {
      const input = '<a href="data:application/javascript,alert(1)">click</a>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('data:application'))
    })
  })

  describe('removes CSS expressions', () => {
    it('removes style with expression()', () => {
      const input = '<div style="width: expression(alert(1))">content</div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('expression('))
    })

    it('removes style with javascript: in url()', () => {
      const input = '<div style="background: url(javascript:alert(1))">content</div>'
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('javascript:'))
    })
  })

  describe('complex sanitization scenarios', () => {
    it('handles mixed allowed and disallowed content', () => {
      const input = '<p>Safe</p><script>evil()</script><b>bold</b><iframe src="x"></iframe><em>italic</em>'
      const result = sanitizeHtml(input)
      assert.ok(result.includes('<p>Safe</p>'))
      assert.ok(result.includes('<b>bold</b>'))
      assert.ok(result.includes('<em>italic</em>'))
      assert.ok(!result.includes('<script'))
      assert.ok(!result.includes('<iframe'))
    })

    it('handles plain text with no HTML', () => {
      const input = 'Hello, this is a plain text email.'
      assert.equal(sanitizeHtml(input), input)
    })

    it('handles HTML entities correctly', () => {
      const input = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
      const result = sanitizeHtml(input)
      // HTML entities should remain as-is (they are safe)
      assert.ok(result.includes('&lt;script&gt;'))
    })

    it('preserves allowed tags with attributes', () => {
      const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>'
      const result = sanitizeHtml(input)
      assert.ok(result.includes('href="https://example.com"'))
    })

    it('handles deeply nested content', () => {
      const input = '<div><p><b><i><em>deep</em></i></b></p></div>'
      assert.equal(sanitizeHtml(input), input)
    })

    it('handles real email HTML structure', () => {
      const input = `
        <html><head><style>.email { color: red; }</style></head>
        <body>
          <div class="email">
            <p>Dear Customer,</p>
            <p>Thank you for contacting <strong>Support</strong>.</p>
            <br>
            <p>Best regards,<br>The Team</p>
          </div>
        </body>
        </html>
      `
      const result = sanitizeHtml(input)
      assert.ok(!result.includes('<html'))
      assert.ok(!result.includes('<head'))
      assert.ok(!result.includes('<style'))
      assert.ok(!result.includes('<body'))
      assert.ok(result.includes('<p>Dear Customer,</p>'))
      assert.ok(result.includes('<strong>Support</strong>'))
    })
  })
})

// ──────────────────────────────────────────────────────────────────
// sanitizeSubject() Tests
// ──────────────────────────────────────────────────────────────────

describe('sanitizeSubject()', () => {
  it('returns the subject unchanged when no prefixes', () => {
    assert.equal(sanitizeSubject('Help with my order'), 'Help with my order')
  })

  it('strips single RE: prefix', () => {
    assert.equal(sanitizeSubject('RE: Help with my order'), 'Help with my order')
  })

  it('strips single Re: prefix (mixed case)', () => {
    assert.equal(sanitizeSubject('Re: Help with my order'), 'Help with my order')
  })

  it('strips single re: prefix (lowercase)', () => {
    assert.equal(sanitizeSubject('re: Help with my order'), 'Help with my order')
  })

  it('strips single FW: prefix', () => {
    assert.equal(sanitizeSubject('FW: Help with my order'), 'Help with my order')
  })

  it('strips single Fw: prefix', () => {
    assert.equal(sanitizeSubject('Fw: Help with my order'), 'Help with my order')
  })

  it('strips single FWD: prefix', () => {
    assert.equal(sanitizeSubject('FWD: Help with my order'), 'Help with my order')
  })

  it('strips single Fwd: prefix', () => {
    assert.equal(sanitizeSubject('Fwd: Help with my order'), 'Help with my order')
  })

  it('strips multiple RE: prefixes', () => {
    assert.equal(sanitizeSubject('RE: RE: RE: Help with my order'), 'Help with my order')
  })

  it('strips mixed RE:/FW: prefixes', () => {
    assert.equal(sanitizeSubject('RE: FW: Help with my order'), 'Help with my order')
  })

  it('strips RE: and FWD: prefixes', () => {
    assert.equal(sanitizeSubject('RE: FWD: RE: Help'), 'Help')
  })

  it('removes ticket reference [ESC-123]', () => {
    assert.equal(sanitizeSubject('[ESC-123] Help with my order'), 'Help with my order')
  })

  it('removes ticket reference with RE: prefix', () => {
    assert.equal(sanitizeSubject('RE: [ESC-456] Help with my order'), 'Help with my order')
  })

  it('removes multiple ticket references', () => {
    assert.equal(sanitizeSubject('[ESC-1] [ESC-2] Subject'), 'Subject')
  })

  it('handles large reference numbers', () => {
    assert.equal(sanitizeSubject('[ESC-999999] Subject'), 'Subject')
  })

  it('trims whitespace', () => {
    assert.equal(sanitizeSubject('  RE: Help  '), 'Help')
  })

  it('returns "(No Subject)" for empty string', () => {
    assert.equal(sanitizeSubject(''), '(No Subject)')
  })

  it('returns "(No Subject)" for whitespace-only', () => {
    assert.equal(sanitizeSubject('   '), '(No Subject)')
  })

  it('returns "(No Subject)" when only RE: prefix remains', () => {
    assert.equal(sanitizeSubject('RE:'), '(No Subject)')
  })

  it('returns "(No Subject)" when only reference remains', () => {
    assert.equal(sanitizeSubject('[ESC-123]'), '(No Subject)')
  })

  it('preserves non-prefix content that looks like RE', () => {
    // "REGARDING" should not be stripped
    assert.equal(sanitizeSubject('REGARDING your order'), 'REGARDING your order')
  })

  it('handles RE: with extra spaces', () => {
    assert.equal(sanitizeSubject('RE:   Help'), 'Help')
  })

  it('handles RE with varying whitespace before colon', () => {
    assert.equal(sanitizeSubject('RE : Help'), 'Help')
  })
})

// ──────────────────────────────────────────────────────────────────
// nameFromEmail() Tests
// ──────────────────────────────────────────────────────────────────

describe('nameFromEmail()', () => {
  it('converts simple email to name', () => {
    assert.equal(nameFromEmail('john@example.com'), 'John')
  })

  it('converts dot-separated email to name', () => {
    assert.equal(nameFromEmail('john.doe@example.com'), 'John Doe')
  })

  it('converts underscore-separated email to name', () => {
    assert.equal(nameFromEmail('john_doe@example.com'), 'John Doe')
  })

  it('converts hyphen-separated email to name', () => {
    assert.equal(nameFromEmail('john-doe@example.com'), 'John Doe')
  })

  it('converts plus-separated email to name', () => {
    assert.equal(nameFromEmail('john+support@example.com'), 'John Support')
  })

  it('handles multiple separators', () => {
    assert.equal(nameFromEmail('john.michael.doe@example.com'), 'John Michael Doe')
  })

  it('handles mixed separators', () => {
    assert.equal(nameFromEmail('john_doe.smith@example.com'), 'John Doe Smith')
  })

  it('capitalizes each word', () => {
    const result = nameFromEmail('first.second.third@example.com')
    assert.equal(result, 'First Second Third')
  })

  it('handles single character local part', () => {
    assert.equal(nameFromEmail('j@example.com'), 'J')
  })

  it('handles numeric local part', () => {
    const result = nameFromEmail('123@example.com')
    // Numbers won't be affected by toUpperCase
    assert.equal(result, '123')
  })

  it('handles all-caps local part', () => {
    const result = nameFromEmail('JOHN@example.com')
    assert.equal(result, 'JOHN')
  })
})

// ──────────────────────────────────────────────────────────────────
// getSanitizedBody() Tests
// ──────────────────────────────────────────────────────────────────

describe('getSanitizedBody()', () => {
  it('returns bodyText when available', () => {
    const message = { bodyText: 'Plain text', bodyHtml: '<p>HTML</p>' }
    assert.equal(getSanitizedBody(message), 'Plain text')
  })

  it('returns sanitized bodyHtml when no bodyText', () => {
    const message = { bodyHtml: '<p>Hello</p><script>evil()</script>' }
    const result = getSanitizedBody(message)
    assert.ok(result.includes('<p>Hello</p>'))
    assert.ok(!result.includes('<script'))
  })

  it('returns empty string when neither bodyText nor bodyHtml', () => {
    const message = {}
    assert.equal(getSanitizedBody(message), '')
  })

  it('prefers bodyText over bodyHtml', () => {
    const message = { bodyText: 'text version', bodyHtml: '<b>html version</b>' }
    assert.equal(getSanitizedBody(message), 'text version')
  })

  it('returns empty string for null bodyHtml with no bodyText', () => {
    const message = { bodyHtml: null }
    assert.equal(getSanitizedBody(message), '')
  })

  it('returns empty bodyText as-is (falsy empty string skipped)', () => {
    // Empty string is falsy, so it falls through to bodyHtml check
    const message = { bodyText: '', bodyHtml: '<p>html</p>' }
    const result = getSanitizedBody(message)
    // bodyText is falsy (empty string), so bodyHtml is used
    assert.ok(result.includes('<p>html</p>'))
  })
})

// ──────────────────────────────────────────────────────────────────
// Blocked Extensions Tests
// ──────────────────────────────────────────────────────────────────

describe('isBlockedExtension()', () => {
  it('blocks .exe files', () => {
    assert.ok(isBlockedExtension('malware.exe'))
  })

  it('blocks .bat files', () => {
    assert.ok(isBlockedExtension('script.bat'))
  })

  it('blocks .cmd files', () => {
    assert.ok(isBlockedExtension('command.cmd'))
  })

  it('blocks .php files', () => {
    assert.ok(isBlockedExtension('shell.php'))
  })

  it('blocks .phar files', () => {
    assert.ok(isBlockedExtension('package.phar'))
  })

  it('blocks .sh files', () => {
    assert.ok(isBlockedExtension('deploy.sh'))
  })

  it('blocks .py files', () => {
    assert.ok(isBlockedExtension('script.py'))
  })

  it('blocks .js files', () => {
    assert.ok(isBlockedExtension('code.js'))
  })

  it('blocks .ps1 (PowerShell) files', () => {
    assert.ok(isBlockedExtension('script.ps1'))
  })

  it('blocks .dll files', () => {
    assert.ok(isBlockedExtension('library.dll'))
  })

  it('blocks .so files', () => {
    assert.ok(isBlockedExtension('library.so'))
  })

  it('blocks .dylib files', () => {
    assert.ok(isBlockedExtension('library.dylib'))
  })

  it('blocks .vbs (Visual Basic Script) files', () => {
    assert.ok(isBlockedExtension('macro.vbs'))
  })

  it('blocks .hta files', () => {
    assert.ok(isBlockedExtension('app.hta'))
  })

  it('blocks .lnk files', () => {
    assert.ok(isBlockedExtension('shortcut.lnk'))
  })

  it('blocks .reg files', () => {
    assert.ok(isBlockedExtension('registry.reg'))
  })

  it('blocks .msi files', () => {
    assert.ok(isBlockedExtension('installer.msi'))
  })

  it('allows .pdf files', () => {
    assert.ok(!isBlockedExtension('document.pdf'))
  })

  it('allows .jpg files', () => {
    assert.ok(!isBlockedExtension('photo.jpg'))
  })

  it('allows .jpeg files', () => {
    assert.ok(!isBlockedExtension('photo.jpeg'))
  })

  it('allows .png files', () => {
    assert.ok(!isBlockedExtension('image.png'))
  })

  it('allows .gif files', () => {
    assert.ok(!isBlockedExtension('animation.gif'))
  })

  it('allows .docx files', () => {
    assert.ok(!isBlockedExtension('document.docx'))
  })

  it('allows .xlsx files', () => {
    assert.ok(!isBlockedExtension('spreadsheet.xlsx'))
  })

  it('allows .txt files', () => {
    assert.ok(!isBlockedExtension('readme.txt'))
  })

  it('allows .csv files', () => {
    assert.ok(!isBlockedExtension('data.csv'))
  })

  it('allows .zip files', () => {
    assert.ok(!isBlockedExtension('archive.zip'))
  })

  it('allows .mp4 files', () => {
    assert.ok(!isBlockedExtension('video.mp4'))
  })

  it('allows .svg files', () => {
    assert.ok(!isBlockedExtension('icon.svg'))
  })

  it('handles files with multiple dots', () => {
    assert.ok(isBlockedExtension('file.backup.exe'))
    assert.ok(!isBlockedExtension('file.backup.pdf'))
  })

  it('handles uppercase extensions via toLowerCase', () => {
    assert.ok(isBlockedExtension('malware.EXE'))
    assert.ok(isBlockedExtension('script.PHP'))
  })

  it('handles mixed case extensions', () => {
    assert.ok(isBlockedExtension('virus.Exe'))
    assert.ok(isBlockedExtension('hack.Php'))
  })
})

// ──────────────────────────────────────────────────────────────────
// Edge cases for sanitization
// ──────────────────────────────────────────────────────────────────

describe('Sanitization edge cases', () => {
  it('handles SVG with embedded script', () => {
    const input = '<svg onload="alert(1)"><circle r="50"/></svg>'
    const result = sanitizeHtml(input)
    // SVG is not in allowed tags, so it should be stripped
    assert.ok(!result.includes('<svg'))
  })

  it('handles data attributes (not dangerous)', () => {
    const input = '<div data-id="123">content</div>'
    const result = sanitizeHtml(input)
    assert.ok(result.includes('data-id="123"'))
  })

  it('handles tag with newlines in attributes', () => {
    const input = '<a\nhref="https://example.com"\n>link</a>'
    const result = sanitizeHtml(input)
    // The tag should still be preserved as 'a' is allowed
    assert.ok(result.includes('link'))
  })

  it('handles empty tag attributes', () => {
    const input = '<p class="">text</p>'
    assert.equal(sanitizeHtml(input), '<p class="">text</p>')
  })

  it('preserves safe inline styles', () => {
    const input = '<p style="color: red; font-size: 14px;">styled</p>'
    const result = sanitizeHtml(input)
    assert.ok(result.includes('style="color: red; font-size: 14px;"'))
  })

  it('handles self-closing allowed tags', () => {
    const input = '<img src="photo.jpg" />'
    const result = sanitizeHtml(input)
    assert.ok(result.includes('<img'))
  })

  it('strips HTML comments as non-allowed', () => {
    const input = '<p>before</p><!-- comment --><p>after</p>'
    const result = sanitizeHtml(input)
    assert.ok(result.includes('<p>before</p>'))
    assert.ok(result.includes('<p>after</p>'))
  })
})
