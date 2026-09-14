import type { HTMLAttributes } from 'react'
import styles from './Card.module.css'

export type CardProps = HTMLAttributes<HTMLDivElement>

/**
 * `components.card` from DESIGN.md: surface background, border, `rounded.lg`
 * corners, no shadow.
 */
export function Card({ className, children, ...rest }: CardProps) {
  const combinedClassName = className ? `${styles.card} ${className}` : styles.card

  return (
    <div className={combinedClassName} {...rest}>
      {children}
    </div>
  )
}
