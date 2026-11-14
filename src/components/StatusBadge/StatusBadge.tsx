import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type BadgeStatus = 'pending' | 'approved' | 'rejected' | 'warning'

const LABELS: Record<BadgeStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  warning: 'Warning',
}

const TONES: Record<BadgeStatus, string> = {
  pending: 'bg-[var(--pending-bg)] text-[var(--pending-fg)] border-[var(--pending-border)]',
  approved: 'bg-[var(--approved-bg)] text-[var(--approved-fg)] border-[var(--approved-border)]',
  rejected: 'bg-[var(--rejected-bg)] text-[var(--rejected-fg)] border-[var(--rejected-border)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning-fg)] border-[var(--warning-border)]',
}

/**
 * Maker-Checker lifecycle badge -- reserved exclusively for record status, the same four-tone
 * vocabulary across all six record types (DESIGN.md), never repurposed for other emphasis.
 */
export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <Badge variant="outline" className={cn('w-fit gap-1.5 rounded-full px-2.5', TONES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {LABELS[status]}
    </Badge>
  )
}

/** Draft is pre-workflow, not a Maker-Checker state -- neutral, not one of the four tones. */
export function DraftLabel() {
  return (
    <Badge variant="secondary" className="w-fit rounded-full px-2.5 text-muted-foreground">
      Draft
    </Badge>
  )
}
