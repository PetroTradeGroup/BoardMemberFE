import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import styles from './FormField.module.css'

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * `components.form-field` from DESIGN.md: labelled input with rest/focus/
 * error border states. The `rejected` status trio is reused for the error
 * state per DESIGN.md's Form field assumption.
 */
export function FormField({ label, error, id, className, ...rest }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const inputClassName = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={inputClassName}
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
