import type { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Field } from './FormField'

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

/** Labelled shadcn Textarea, same layout/error pattern as FormField. */
export function TextAreaField({ label, error, id, ...rest }: TextAreaFieldProps) {
  const generatedId = useId()
  const textAreaId = id ?? generatedId
  return (
    <Field label={label} htmlFor={textAreaId} error={error}>
      <Textarea
        id={textAreaId}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textAreaId}-error` : undefined}
      />
    </Field>
  )
}
