import styles from './StatusBadge.module.css'

export type BadgeStatus = 'pending' | 'approved' | 'rejected' | 'warning'

const LABELS: Record<BadgeStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  warning: 'Warning',
}

/**
 * `components.status-badge-{pending,approved,rejected,warning}` from
 * DESIGN.md — reserved exclusively for Maker-Checker lifecycle state
 * (Do/Don't table: "Same status-badge vocabulary across all six
 * Maker-Checker record types" / never repurposed for other UI emphasis).
 */
export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {LABELS[status]}
    </span>
  )
}

/**
 * Draft is deliberately NOT one of the four badge colors (EXPERIENCE.md
 * State Patterns: "Draft ... neutral treatment — no status badge from the
 * four-color vocabulary, draft is pre-workflow, not a Maker-Checker
 * state"). A plain uppercase text label instead.
 */
export function DraftLabel() {
  return <span className={styles.draftLabel}>Draft</span>
}
