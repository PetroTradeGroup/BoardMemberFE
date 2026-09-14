import type { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import styles from './FormField.module.css'

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

/**
 * A `<textarea>` sharing FormField's exact classes (label/rest/focus/error
 * border states), same rationale as SelectField: UX-DR6 reuse of the
 * existing form-field visual pattern, defined per-element-type.
 */
export function TextAreaField({ label, error, id, className, ...rest }: TextAreaFieldProps) {
  const generatedId = useId()
  const textAreaId = id ?? generatedId
  const errorId = `${textAreaId}-error`
  const textAreaClassName = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={textAreaId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={textAreaId}
        className={textAreaClassName}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span id={errorId} className={styles.errorText} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
