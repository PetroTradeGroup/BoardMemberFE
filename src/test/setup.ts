import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Vitest doesn't enable global `afterEach` by default (test.globals is not
// set), so @testing-library/react's own auto-cleanup detection doesn't
// register. Do it explicitly so each test starts from an empty DOM.
afterEach(() => {
  cleanup()
})
