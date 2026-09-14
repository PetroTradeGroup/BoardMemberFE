import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

/**
 * `components.button-primary` / `components.button-secondary` from
 * DESIGN.md. Exactly two variants — no destructive/red style.
 */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const variantClassName = variant === 'primary' ? styles.primary : styles.secondary
  const combinedClassName = [styles.button, variantClassName, className].filter(Boolean).join(' ')

  return <button type={type} className={combinedClassName} {...rest} />
}
