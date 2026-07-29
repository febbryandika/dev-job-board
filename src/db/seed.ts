import { inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { applications, jobs } from '@/db/schema'
import { auth } from '@/lib/auth'

// Credentials are published in the README so a reviewer can log in without
// setting anything up. SPEC §Deliverables.
const DEMO_PASSWORD = 'demo1234'

const DEMO_USERS = [
  { email: 'candidate@demo.dev', name: 'Aiko Tanaka', role: 'candidate' },
  { email: 'employer@demo.dev', name: 'Kenji Sato', role: 'employer' },
  { email: 'admin@demo.dev', name: 'Site Admin', role: 'admin' },
] as const

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * DAY)

type SeedJob = Omit<typeof jobs.$inferInsert, 'employerId'>

// ~20 listings across all four statuses so the moderation queue and the
// rejected → resubmit path are both non-empty on first load. Locations,
// salaries (JPY) and tags are drawn from the real Japanese market. SPEC §11.
const JOB_SEEDS: SeedJob[] = [
  {
    title: 'Senior Frontend Engineer',
    company: 'Kaizen Labs',
    location: 'Shibuya, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 8_000_000,
    salaryMax: 12_000_000,
    description:
      '## About the role\n\nOwn the booking flow end to end — Next.js App Router, Server Components, and a design system we actually maintain.\n\n### You will\n\n- Ship features against a real product roadmap\n- Pair with designers in Figma before writing code\n- Keep Core Web Vitals green\n\n**Team language:** English, with Japanese for customer calls.',
    tags: ['TypeScript', 'React', 'Next.js', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(21),
    approvedAt: daysAgo(20),
  },
  {
    title: 'Backend Engineer (Go)',
    company: 'Minato Systems',
    location: 'Minato, Tokyo',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: 7_500_000,
    salaryMax: 11_000_000,
    description:
      '## What you will build\n\nPayment and reconciliation services in Go, running on ECS. Roughly 40k transactions a day and growing.\n\n### Requirements\n\n- 3+ years with Go or a similar systems language\n- Comfortable owning a service in production\n- Business-level Japanese for internal meetings',
    tags: ['Go', 'AWS', 'PostgreSQL', '日本語N2+'],
    status: 'approved',
    createdAt: daysAgo(19),
    approvedAt: daysAgo(18),
  },
  {
    title: 'Full-Stack Engineer',
    company: 'Umeda Digital',
    location: 'Osaka',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 6_000_000,
    salaryMax: 9_000_000,
    description:
      '## The product\n\nAn internal ordering system used by 300 restaurants across Kansai. You would be the third engineer.\n\n### Stack\n\nNext.js, Drizzle, PostgreSQL, deployed on Vercel. No legacy to inherit.',
    tags: ['TypeScript', 'Next.js', 'PostgreSQL'],
    status: 'approved',
    createdAt: daysAgo(18),
    approvedAt: daysAgo(17),
  },
  {
    title: 'Platform Engineer',
    company: 'Hakata Cloud',
    location: 'Fukuoka',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 6_500_000,
    salaryMax: 9_500_000,
    description:
      '## Role\n\nOwn the Kubernetes platform our product teams deploy onto. You decide what "paved road" means here.\n\n- Terraform for everything\n- On-call one week in six, properly compensated',
    tags: ['Kubernetes', 'AWS', 'Go', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(17),
    approvedAt: daysAgo(16),
  },
  {
    title: 'React Native Engineer',
    company: 'Sakura Mobile',
    location: 'フルリモート',
    locationType: 'remote',
    roleType: 'fulltime',
    salaryMin: 7_000_000,
    salaryMax: 10_000_000,
    description:
      '## Fully remote, within Japan\n\nOur consumer app has 1.2M installs. You would own the iOS and Android release trains.\n\n### Nice to have\n\n- Experience with Expo EAS\n- An eye for animation detail',
    tags: ['React', 'TypeScript', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(16),
    approvedAt: daysAgo(15),
  },
  {
    title: 'Data Engineer',
    company: 'Kaizen Labs',
    location: 'Shibuya, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 7_000_000,
    salaryMax: 10_500_000,
    description:
      '## What you will do\n\nBuild the pipelines behind our analytics product — dbt, Airflow, and a Redshift warehouse we are migrating off.\n\nThe migration is the job. We want someone who has done it before.',
    tags: ['Python', 'AWS', 'PostgreSQL', '日本語N2+'],
    status: 'approved',
    createdAt: daysAgo(15),
    approvedAt: daysAgo(14),
  },
  {
    title: 'DevOps Engineer',
    company: 'Namba Works',
    location: 'Osaka',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: 5_500_000,
    salaryMax: 8_500_000,
    description:
      '## About us\n\nA 40-person SaaS company serving Kansai logistics firms. Our CI takes 22 minutes and we would like it to take five.\n\n### You bring\n\n- GitHub Actions in anger\n- Opinions about build caching',
    tags: ['AWS', 'Go', '日本語N2+'],
    status: 'approved',
    createdAt: daysAgo(14),
    approvedAt: daysAgo(13),
  },
  {
    title: 'Frontend Engineer (Contract)',
    company: 'Tenjin Interactive',
    location: 'Fukuoka',
    locationType: 'remote',
    roleType: 'contract',
    salaryMin: 6_000_000,
    salaryMax: null,
    description:
      '## Six-month contract, extendable\n\nRebuild the marketing site with Next.js and a headless CMS. Fully remote, invoice monthly.\n\nDay rate negotiable for the right person.',
    tags: ['Next.js', 'TypeScript', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(13),
    approvedAt: daysAgo(12),
  },
  {
    title: 'Junior Web Developer',
    company: 'Umeda Digital',
    location: 'Osaka',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: 4_000_000,
    salaryMax: 5_500_000,
    description:
      '## First engineering job?\n\nWe will pair you with a senior for the first three months. You need to be able to build a CRUD app in something — we do not mind what.\n\n**Japanese required** for day-to-day work.',
    tags: ['TypeScript', 'React', '日本語N2+'],
    status: 'approved',
    createdAt: daysAgo(12),
    approvedAt: daysAgo(11),
  },
  {
    title: 'Site Reliability Engineer',
    company: 'Minato Systems',
    location: 'Minato, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 9_000_000,
    salaryMax: 14_000_000,
    description:
      '## Scope\n\nYou would be our first dedicated SRE. Error budgets, incident review, and the authority to block a release.\n\n### Requirements\n\n- Ran production at meaningful scale\n- Can write Go, not just read it',
    tags: ['Go', 'Kubernetes', 'AWS', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(11),
    approvedAt: daysAgo(10),
  },
  {
    title: 'Part-Time QA Engineer',
    company: 'Sakura Mobile',
    location: 'フルリモート',
    locationType: 'remote',
    roleType: 'parttime',
    salaryMin: null,
    salaryMax: 4_500_000,
    description:
      '## 20 hours a week\n\nOwn our Playwright suite. It exists but nobody loves it.\n\nFlexible hours — we care about the suite being green before each release, not when you work.',
    tags: ['TypeScript', 'English OK'],
    status: 'approved',
    createdAt: daysAgo(10),
    approvedAt: daysAgo(9),
  },
  {
    title: 'Engineering Manager',
    company: 'Hakata Cloud',
    location: 'Fukuoka',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 10_000_000,
    salaryMax: 15_000_000,
    description:
      '## Two teams, eleven engineers\n\nHalf your week is people, half is architecture. We are not looking for someone who has stopped writing code, nor for someone who wants to write it full time.\n\n**Bilingual role** — the teams work in Japanese, the leadership meetings in English.',
    tags: ['English OK', '日本語N2+'],
    status: 'approved',
    createdAt: daysAgo(9),
    approvedAt: daysAgo(8),
  },

  // --- pending: what the admin sees in the moderation queue, oldest first ---
  {
    title: 'Rust Systems Engineer',
    company: 'Akihabara Robotics',
    location: 'Chiyoda, Tokyo',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: 8_500_000,
    salaryMax: 13_000_000,
    description:
      '## Real-time control\n\nFirmware and control-plane software for warehouse robots. Rust on the device, Go on the server.\n\nSafety-critical work — expect thorough code review.',
    tags: ['Rust', 'Go', '日本語N2+'],
    status: 'pending',
    createdAt: daysAgo(6),
  },
  {
    title: 'Machine Learning Engineer',
    company: 'Kaizen Labs',
    location: 'Shibuya, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 9_000_000,
    salaryMax: 13_500_000,
    description:
      '## Recommendations\n\nOwn the ranking model behind our marketplace. Offline metrics are in place; the online experiment framework is not, and that is your first project.',
    tags: ['Python', 'AWS', 'English OK'],
    status: 'pending',
    createdAt: daysAgo(4),
  },
  {
    title: 'Technical Writer',
    company: 'Namba Works',
    location: 'フルリモート',
    locationType: 'remote',
    roleType: 'contract',
    salaryMin: null,
    salaryMax: null,
    description:
      '## Documentation, properly\n\nOur API reference is generated and unreadable. Rewrite it, then keep it honest as the API changes.\n\nSalary negotiable depending on availability.',
    tags: ['English OK', '日本語N2+'],
    status: 'pending',
    createdAt: daysAgo(3),
  },
  {
    title: 'Security Engineer',
    company: 'Minato Systems',
    location: 'Minato, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 8_000_000,
    salaryMax: 12_500_000,
    description:
      '## Application security\n\nThreat modelling, dependency hygiene, and the annual pentest. You would report to the CTO.\n\n### Requirements\n\n- Can read Go and TypeScript\n- Has run a bug bounty programme, or wants to start one',
    tags: ['Go', 'AWS', 'English OK'],
    status: 'pending',
    createdAt: daysAgo(1),
  },

  // --- rejected: the resubmit path. Editing one of these resets it to pending ---
  {
    title: 'Web Developer',
    company: 'Quick Hire KK',
    location: 'Tokyo',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: null,
    salaryMax: null,
    description: 'Looking for a web developer. Details on call.',
    tags: [],
    status: 'rejected',
    createdAt: daysAgo(8),
    rejectionNote:
      'Please add a salary range and a real description of the work. Listings without either are rejected.',
  },
  {
    title: 'Ninja Rockstar Developer 🚀',
    company: 'Growth Ventures',
    location: 'Shibuya, Tokyo',
    locationType: 'onsite',
    roleType: 'fulltime',
    salaryMin: 3_000_000,
    salaryMax: 4_000_000,
    description:
      'We want a ROCKSTAR who can wear many hats and thrives under pressure! Long hours, huge upside. Equity discussed after year one.',
    tags: ['TypeScript'],
    status: 'rejected',
    createdAt: daysAgo(5),
    rejectionNote:
      'The tone and the stated hours do not meet our listing standards, and the range is below market for this role. Please revise and resubmit.',
  },

  // --- closed: approved, filled, then closed by the employer ---
  {
    title: 'Infrastructure Engineer',
    company: 'Umeda Digital',
    location: 'Osaka',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 6_500_000,
    salaryMax: 9_000_000,
    description:
      '## Position filled\n\nWe were looking for someone to own our Terraform estate and CI pipelines.',
    tags: ['AWS', 'Go', '日本語N2+'],
    status: 'closed',
    createdAt: daysAgo(40),
    approvedAt: daysAgo(39),
  },
  {
    title: 'Product Designer (Engineering-adjacent)',
    company: 'Sakura Mobile',
    location: 'フルリモート',
    locationType: 'remote',
    roleType: 'contract',
    salaryMin: 5_000_000,
    salaryMax: 7_000_000,
    description:
      '## Position filled\n\nDesign system work for our mobile app, in close pair with the frontend team.',
    tags: ['React', 'English OK'],
    status: 'closed',
    createdAt: daysAgo(35),
    approvedAt: daysAgo(34),
  },
]

async function createDemoUser(email: string, name: string) {
  const result = await auth.api.signUpEmail({
    body: { email, name, password: DEMO_PASSWORD },
  })

  return result.user.id
}

async function seed() {
  const emails = DEMO_USERS.map((u) => u.email)

  // `jobs.reviewed_by` references `user.id` with no ON DELETE rule, so if the
  // demo admin has reviewed a listing owned by someone else — which happens as
  // soon as anyone posts a job and it gets moderated — deleting the demo users
  // fails on that constraint and the seed is no longer re-runnable. Clearing
  // the reference first is the fix; the listing keeps its status, it just loses
  // a reviewer that is about to stop existing.
  await db.execute(
    sql`update jobs set reviewed_by = null
        where reviewed_by in (select id from "user" where email in (${sql.join(
          emails.map((email) => sql`${email}`),
          sql`, `
        )}))`
  )

  // Re-runnable: drop the demo users. Every seeded job and application hangs
  // off them via ON DELETE CASCADE, so this clears the whole seed set without
  // touching anything a developer created by hand.
  const removed = await db.delete(user).where(inArray(user.email, emails)).returning({ id: user.id })
  if (removed.length > 0) {
    console.log(`Removed ${removed.length} existing demo user(s) and their data.`)
  }

  const userIds: Record<string, string> = {}

  for (const demo of DEMO_USERS) {
    const id = await createDemoUser(demo.email, demo.name)
    // `role` is `input: false` on the Better Auth user, so signup always lands
    // on the default `candidate`. Employer and admin are assigned here, in the
    // database — which is exactly how admin is meant to be granted. SPEC §3.1.
    await db.update(user).set({ role: demo.role }).where(inArray(user.id, [id]))
    userIds[demo.email] = id
  }

  const employerId = userIds['employer@demo.dev']
  const adminId = userIds['admin@demo.dev']
  const candidateId = userIds['candidate@demo.dev']

  if (!employerId || !adminId || !candidateId) {
    throw new Error('Demo users were not created — cannot seed listings.')
  }

  const inserted = await db
    .insert(jobs)
    .values(
      JOB_SEEDS.map((job) => ({
        ...job,
        employerId,
        // Every decision records who made it and when — the audit trail the
        // moderation workflow depends on. SPEC §3.5.
        ...(job.status === 'pending'
          ? {}
          : { reviewedBy: adminId, reviewedAt: job.approvedAt ?? job.createdAt }),
      }))
    )
    .returning({ id: jobs.id, title: jobs.title, status: jobs.status })

  // Three applications so the employer dashboard's applicant counts and the
  // candidate's own list are both non-empty on first load.
  const approved = inserted.filter((job) => job.status === 'approved').slice(0, 3)

  await db.insert(applications).values(
    approved.map((job, i) => ({
      jobId: job.id,
      applicantId: candidateId,
      resumeUrl: 'https://example.com/aiko-tanaka-resume.pdf',
      coverLetter: `I have been following ${job.title.toLowerCase()} roles for a while and would love to talk. I have shipped production TypeScript for four years.`,
      createdAt: daysAgo(7 - i),
    }))
  )

  const byStatus = inserted.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})

  console.log(`Seeded ${DEMO_USERS.length} users (password: ${DEMO_PASSWORD})`)
  console.log(`Seeded ${inserted.length} listings:`, byStatus)
  console.log(`Seeded ${approved.length} applications`)
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
