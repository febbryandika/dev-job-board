import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Job descriptions are written by employers, so this module is the boundary
 * between untrusted input and rendered HTML. Everything here is deny-by-default:
 * the allowlist below is the complete set of tags and attributes that can ever
 * reach the page. SPEC §9.
 */

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // No img, iframe, video, style, form, or input. Nothing that loads a remote
  // resource or accepts user interaction.
  allowedTags: [
    'p',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'blockquote',
    'a',
    'br',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  // No `on*` handlers, no `style`, no `class`, no `id` (which could collide
  // with the page's own anchors). `rel` and `target` are listed because
  // attribute filtering runs after transformTags below — whatever the author
  // wrote is overwritten there, so allowing them is not a way in.
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  // javascript: and data: are absent on purpose — those are the two schemes
  // that turn a link into script execution.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // An employer-submitted link is untrusted: don't pass link equity to it,
    // and don't hand the opened tab a reference to ours.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'nofollow noopener noreferrer',
        target: '_blank',
      },
    }),
  },
}

const renderer = new marked.Renderer()

// The page owns the only <h1>. A description starting with `#` would otherwise
// emit a second one and break the document outline — so every heading is
// demoted two levels and clamped at h4.
renderer.heading = ({ tokens, depth }) => {
  const level = Math.min(depth + 1, 4)
  return `<h${level}>${marked.parseInline(tokens.map((t) => t.raw).join(''))}</h${level}>\n`
}

/** Markdown → HTML that is safe to pass to `dangerouslySetInnerHTML`. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { gfm: true, async: false, renderer })

  return sanitizeHtml(html, SANITIZE_OPTIONS)
}

/**
 * Markdown → plain text, for the meta description and the JSON-LD summary.
 * Strips to text via the sanitizer rather than with regexes, so it cannot
 * disagree with what `renderMarkdown` considers markup.
 */
export function toPlainText(markdown: string): string {
  const html = marked.parse(markdown, { gfm: true, async: false })
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })

  return text.replace(/\s+/g, ' ').trim()
}

/**
 * A meta description, cut on a word boundary so it doesn't end mid-word.
 * ~160 characters is what search results show. SPEC §8.
 */
export function toMetaDescription(markdown: string, maxLength = 160): string {
  const text = toPlainText(markdown)
  if (text.length <= maxLength) return text

  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
