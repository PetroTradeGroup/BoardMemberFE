import type { ReactNode } from 'react'
import { Card } from '@/components/Card/Card'
import { cn } from '@/lib/utils'

/** Standard page frame for the rebuilt screens: same width/padding as the dashboard. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8', className)}>{children}</main>
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

/** Small labelled number; `aria-label` keeps "Label: value" readable as one phrase. */
export function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: 'warning' | 'success' }) {
  return (
    <div
      aria-label={`${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}`}
      className={cn(
        'rounded-lg border bg-card px-4 py-3',
        tone === 'warning' && 'border-[var(--pending-border)] bg-[var(--pending-bg)]',
        tone === 'success' && 'border-[var(--approved-border)] bg-[var(--approved-bg)]',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xl font-semibold">{value}</p>
    </div>
  )
}

export function Section({ title, description, actions, children, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  )
}

/** Inline form outcome: error (announced) or success. */
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p className="rounded-md border border-[var(--rejected-border)] bg-[var(--rejected-bg)] px-3 py-2 text-sm text-[var(--rejected-fg)]" role="alert">
        {error}
      </p>
    )
  }
  if (success) {
    return (
      <p className="rounded-md border border-[var(--approved-border)] bg-[var(--approved-bg)] px-3 py-2 text-sm text-[var(--approved-fg)]" role="status">
        {success}
      </p>
    )
  }
  return null
}

/** Initials avatar + full name, for user tables. */
export function PersonCell({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
        {`${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()}
      </span>
      <span className="font-medium">{`${firstName} ${lastName}`}</span>
    </span>
  )
}

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
      {icon ? <span className="text-muted-foreground/60 [&_svg]:size-8">{icon}</span> : null}
      <p>{children}</p>
    </div>
  )
}
