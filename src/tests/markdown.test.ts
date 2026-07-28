import { describe, expect, it } from 'vitest'

import { renderMarkdown, toMetaDescription, toPlainText } from '@/lib/markdown'

// Job descriptions come from employers, so this is the one place untrusted
// content becomes HTML. These tests are adversarial on purpose.
describe('renderMarkdown — XSS', () => {
  it.each([
    ['script tag', '<script>alert(1)</script>'],
    ['script with attributes', '<script src="https://evil.test/x.js"></script>'],
    ['img onerror', '<img src=x onerror="alert(1)">'],
    ['svg onload', '<svg onload="alert(1)"></svg>'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['object', '<object data="evil.swf"></object>'],
    ['embed', '<embed src="evil.swf">'],
    ['style block', '<style>body{display:none}</style>'],
    ['form', '<form action="https://evil.test"><input name="pw"></form>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
    ['base tag', '<base href="https://evil.test/">'],
  ])('strips %s', (_label, payload) => {
    const html = renderMarkdown(payload)

    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<object')
    expect(html).not.toContain('<embed')
    expect(html).not.toContain('<base')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('alert(1)')
  })

  it.each([
    ['javascript:', '[click](javascript:alert(1))'],
    ['JaVaScRiPt: mixed case', '[click](JaVaScRiPt:alert(1))'],
    ['data: html', '[click](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript:', '[click](vbscript:msgbox(1))'],
    ['protocol-relative', '[click](//evil.test)'],
  ])('drops a %s href', (_label, markdown) => {
    const html = renderMarkdown(markdown)

    expect(html.toLowerCase()).not.toContain('javascript:')
    expect(html.toLowerCase()).not.toContain('data:text/html')
    expect(html.toLowerCase()).not.toContain('vbscript:')
    expect(html).not.toContain('href="//')
  })

  it('strips event handlers written as markdown-embedded HTML', () => {
    const html = renderMarkdown('Hello <a href="https://ok.test" onclick="steal()">there</a>')

    expect(html).not.toContain('onclick')
    expect(html).not.toContain('steal()')
  })

  it('removes style and class attributes', () => {
    const html = renderMarkdown('<p style="position:fixed;inset:0" class="overlay">hi</p>')

    expect(html).not.toContain('style=')
    expect(html).not.toContain('class=')
  })

  // The description is also embedded in the JSON-LD <script> block, so a
  // closing tag inside it must not survive as markup.
  it('neutralises an embedded closing script tag', () => {
    const html = renderMarkdown('Great role </script><script>alert(1)</script> apply now')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })
})

describe('renderMarkdown — legitimate content survives', () => {
  it('renders paragraphs, emphasis and lists', () => {
    const html = renderMarkdown('Build **great** things\n\n- One\n- Two')

    expect(html).toContain('<strong>great</strong>')
    expect(html).toContain('<li>One</li>')
    expect(html).toContain('<li>Two</li>')
  })

  it('renders code blocks and inline code', () => {
    const html = renderMarkdown('Use `pnpm dev`\n\n```\nnext build\n```')

    expect(html).toContain('<code>pnpm dev</code>')
    expect(html).toContain('next build')
  })

  it('keeps Japanese text intact', () => {
    expect(renderMarkdown('**フルリモート** 日本語N2+')).toContain('フルリモート')
  })

  it('keeps https links and hardens them', () => {
    const html = renderMarkdown('[Careers](https://example.test/careers)')

    expect(html).toContain('href="https://example.test/careers"')
    expect(html).toContain('rel="nofollow noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  // `rel`/`target` are allowlisted so the transform's output survives; this
  // asserts an author cannot use that to set their own values.
  it('overwrites an author-supplied rel and target', () => {
    const html = renderMarkdown('<a href="https://example.test" rel="dofollow" target="_self">x</a>')

    expect(html).toContain('rel="nofollow noopener noreferrer"')
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('dofollow')
    expect(html).not.toContain('_self')
  })

  it('allows mailto links', () => {
    expect(renderMarkdown('[Email](mailto:jobs@example.test)')).toContain('mailto:jobs@example.test')
  })

  // The page owns the <h1>; a description must never emit a competing one.
  it('demotes headings and never emits an h1', () => {
    const html = renderMarkdown('# Top\n\n## Second\n\n### Third\n\n#### Fourth')

    expect(html).not.toContain('<h1')
    expect(html).toContain('<h2>Top</h2>')
    expect(html).toContain('<h3>Second</h3>')
    expect(html).toContain('<h4>Third</h4>')
    // Clamped, so deep nesting can't run past h4.
    expect(html).toContain('<h4>Fourth</h4>')
  })

  it('escapes text that merely looks like markup', () => {
    expect(renderMarkdown('Use the <T> generic')).not.toContain('<T>')
  })
})

describe('toPlainText', () => {
  it('strips markup and collapses whitespace', () => {
    expect(toPlainText('## Role\n\nBuild **great** things.\n\n- One\n- Two')).toBe(
      'Role Build great things. One Two'
    )
  })

  it('drops script content entirely rather than leaking its source', () => {
    expect(toPlainText('Hi <script>alert(1)</script> there')).not.toContain('alert(1)')
  })

  it('returns an empty string for empty input', () => {
    expect(toPlainText('')).toBe('')
  })
})

describe('toMetaDescription', () => {
  it('returns short text unchanged and unellipsised', () => {
    expect(toMetaDescription('Short and sweet.')).toBe('Short and sweet.')
  })

  it('truncates long text on a word boundary', () => {
    const result = toMetaDescription('word '.repeat(80))

    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toContain('wor…')
  })

  it('respects a custom length', () => {
    expect(toMetaDescription('word '.repeat(80), 40).length).toBeLessThanOrEqual(40)
  })

  // A single unbroken token has no space to cut on; it must still be bounded.
  it('still truncates when there is no word boundary', () => {
    const result = toMetaDescription('x'.repeat(300))

    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.endsWith('…')).toBe(true)
  })
})
