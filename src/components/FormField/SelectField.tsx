import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field } from './FormField'

export interface SelectFieldOption {
  value: string
  label: string
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectFieldOption[]
  error?: string
}

/**
 * Native `<select>` styled to match shadcn's Input. Kept native (not Radix Select) on purpose:
 * full keyboard/screen-reader/mobile picker support for free, and works with plain form tests.
 */
export function SelectField({ label, options, error, id, className, ...rest }: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <Field label={label} htmlFor={selectId} error={error}>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'h-10 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-sm shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
            '[&>option]:bg-popover [&>option]:text-popover-foreground',
            className,
          )}
          {...rest}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </Field>
  )
}
