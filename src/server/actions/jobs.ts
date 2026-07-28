// TODO(phase-6): createJob / updateJob / closeJob.
// Each action: requireRole() → Zod safeParse → ownership check → write →
// revalidatePath(). Returns { ok: true } | { ok: false, error }. SPEC §5.
