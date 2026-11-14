import type { ButtonHTMLAttributes } from 'react'
import { Button as UiButton } from '@/components/ui/button'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

/**
 * App-level button on top of shadcn's Button: `primary` = solid brand teal, `secondary` =
 * outline. Exactly two variants, no destructive/red style (DESIGN.md).
 */
export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return <UiButton type={type} variant={variant === 'primary' ? 'default' : 'outline'} data-app-variant={variant} {...rest} />
}
