import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/** Labelled shadcn Input with an inline, announced error message. */
export function FormField({ label, error, id, className, ...rest }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field label={label} htmlFor={inputId} error={error}>
      <Input
        id={inputId}
        className={className ? `h-10 ${className}` : 'h-10'}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
    </Field>
  )
}

/** Shared label + control + error layout for FormField / SelectField / TextAreaField. */
export function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
