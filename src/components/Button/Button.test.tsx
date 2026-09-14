import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import styles from './Button.module.css'

describe('Button', () => {
  it('renders the primary variant by default', () => {
    render(<Button>Sign in</Button>)

    const button = screen.getByRole('button', { name: 'Sign in' })
    expect(button.className).toContain(styles.primary)
    expect(button.className).not.toContain(styles.secondary)
  })

  it('renders the secondary variant when requested', () => {
    render(<Button variant="secondary">Sign out</Button>)

    const button = screen.getByRole('button', { name: 'Sign out' })
    expect(button.className).toContain(styles.secondary)
    expect(button.className).not.toContain(styles.primary)
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Submit</Button>)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
