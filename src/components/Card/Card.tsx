import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type CardProps = HTMLAttributes<HTMLDivElement>

/** Surface container (shadcn card styling). Padding/layout stay with each screen. */
export function Card({ className, ...rest }: CardProps) {
  return <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...rest} />
}
