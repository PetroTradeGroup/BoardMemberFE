import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import styles from './FormField.module.css'

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
 * A `<select>` sharing FormField's exact classes (label/rest/focus/error
 * border states) rather than a new component with its own styling — UX-DR6
 * requires reusing the existing Form-field visual pattern, which is defined
 * per-element-type upstream (input vs. select can't share one DOM tag), not
 * per-component.
 */
export function SelectField({ label, options, error, id, className, ...rest }: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`
  const selectClassName = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        className={selectClassName}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span id={errorId} className={styles.errorText} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
