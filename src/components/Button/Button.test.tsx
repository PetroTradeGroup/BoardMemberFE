import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders the primary variant by default', () => {
    render(<Button>Sign in</Button>)

    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('data-app-variant', 'primary')
  })

  it('renders the secondary variant when requested', () => {
    render(<Button variant="secondary">Sign out</Button>)

    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute('data-app-variant', 'secondary')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Submit</Button>)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
