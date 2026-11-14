import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'

describe('FormField', () => {
  it('renders a labelled input with no error by default', () => {
    render(<FormField label="Username" />)

    const input = screen.getByLabelText('Username')
    expect(input).toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error state: aria-invalid (drives the red border) plus a linked alert', () => {
    render(<FormField label="Username" error="Username is required" />)

    const input = screen.getByLabelText('Username')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Username is required')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
  })
})
