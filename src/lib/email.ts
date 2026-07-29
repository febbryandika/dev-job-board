import { Resend } from 'resend'

import { absoluteUrl } from '@/lib/site'

/**
 * Three transactional emails, all to the employer. SPEC §3.6.
 *
 * The rule that shapes this module: **a send failure is logged and never
 * blocks or rolls back the write**, which has already committed by the time
 * anything here runs. `sendEmail` therefore never rejects and never throws.
 */

export type EmailMessage = {
  subject: string
  html: string
  text: string
}

const DEFAULT_FROM = 'Dev Job Board <onboarding@resend.dev>'

// Lazily constructed so importing this module never throws without a key —
// which is what lets the templates be unit-tested and the console fallback
// work offline.
let client: Resend | undefined

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null

  client ??= new Resend(apiKey)
  return client
}

/**
 * Sends, or logs when there is no API key so a clean clone and the E2E suite
 * work offline. Returns how it was handled rather than throwing, so a caller
 * cannot accidentally make a user-facing action depend on it.
 */
export async function sendEmail(
  to: string,
  message: EmailMessage
): Promise<'sent' | 'logged' | 'failed'> {
  const resend = getClient()

  if (!resend) {
    console.info(
      `[email] RESEND_API_KEY not set — not sending.\n  to: ${to}\n  subject: ${message.subject}\n  text: ${message.text}`
    )
    return 'logged'
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })

    // Resend reports some failures in the payload rather than by throwing.
    if (error) {
      console.error(`[email] send failed for "${message.subject}" to ${to}:`, error)
      return 'failed'
    }

    return 'sent'
  } catch (error) {
    console.error(`[email] send threw for "${message.subject}" to ${to}:`, error)
    return 'failed'
  }
}

/**
 * Job titles, applicant names and rejection notes are user-authored, and they
 * end up inside HTML in someone's inbox. Escaped rather than sanitized: none of
 * these fields is meant to carry markup at all.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function layout(heading: string, body: string, cta: { href: string; label: string }): string {
  return [
    `<div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #171717;">`,
    `<h1 style="font-size: 18px; margin: 0 0 12px;">${heading}</h1>`,
    body,
    `<p style="margin: 20px 0;"><a href="${cta.href}" style="background:#171717;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">${cta.label}</a></p>`,
    `<p style="font-size: 12px; color: #737373;">Dev Job Board</p>`,
    `</div>`,
  ].join('')
}

export function newApplicationEmail(input: {
  jobTitle: string
  applicantName: string
}): EmailMessage {
  const url = absoluteUrl('/dashboard/employer')
  const title = escapeHtml(input.jobTitle)
  const name = escapeHtml(input.applicantName)

  return {
    subject: `New application for ${input.jobTitle}`,
    html: layout(
      `New application for ${title}`,
      `<p style="margin:0;"><strong>${name}</strong> has applied. Their résumé and cover letter are on your dashboard.</p>`,
      { href: url, label: 'View applications' }
    ),
    text: `${input.applicantName} has applied for ${input.jobTitle}.\n\nView applications: ${url}`,
  }
}

export function jobApprovedEmail(input: { jobTitle: string; jobId: string }): EmailMessage {
  const url = absoluteUrl(`/jobs/${input.jobId}`)
  const title = escapeHtml(input.jobTitle)

  return {
    subject: `${input.jobTitle} is now live`,
    html: layout(
      `${title} is now live`,
      `<p style="margin:0;">Your listing has been approved and is public. Candidates can find and apply to it now.</p>`,
      { href: url, label: 'View the listing' }
    ),
    text: `${input.jobTitle} has been approved and is now public.\n\nView the listing: ${url}`,
  }
}

export function jobRejectedEmail(input: {
  jobTitle: string
  jobId: string
  note: string
}): EmailMessage {
  const url = absoluteUrl(`/dashboard/employer/${input.jobId}/edit`)
  const title = escapeHtml(input.jobTitle)
  const note = escapeHtml(input.note)

  return {
    subject: `${input.jobTitle} needs changes before it goes live`,
    html: layout(
      `${title} needs changes`,
      `<p style="margin:0 0 12px;">A reviewer couldn&#39;t publish this listing yet:</p>` +
        `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d4d4d4;color:#525252;">${note}</blockquote>` +
        `<p style="margin:12px 0 0;">Editing the listing resubmits it for review.</p>`,
      { href: url, label: 'Edit the listing' }
    ),
    text: `${input.jobTitle} was not published.\n\nReason: ${input.note}\n\nEditing the listing resubmits it for review: ${url}`,
  }
}
