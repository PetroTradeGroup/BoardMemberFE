import { describe, expect, it } from 'vitest'
import { InMemoryStateStore } from './InMemoryStateStore'

describe('InMemoryStateStore', () => {
  it('round-trips a value through set/get', async () => {
    const store = new InMemoryStateStore()

    await store.set('key-a', 'value-a')

    expect(await store.get('key-a')).toBe('value-a')
  })

  it('returns null for a key that was never set', async () => {
    const store = new InMemoryStateStore()

    expect(await store.get('missing')).toBeNull()
  })

  it('remove deletes the key and returns its prior value', async () => {
    const store = new InMemoryStateStore()
    await store.set('key-a', 'value-a')

    const removed = await store.remove('key-a')

    expect(removed).toBe('value-a')
    expect(await store.get('key-a')).toBeNull()
  })

  it('getAllKeys lists every key currently stored', async () => {
    const store = new InMemoryStateStore()
    await store.set('key-a', 'value-a')
    await store.set('key-b', 'value-b')

    expect(await store.getAllKeys()).toEqual(['key-a', 'key-b'])
  })

  it('never touches localStorage or sessionStorage', async () => {
    const store = new InMemoryStateStore()

    await store.set('key-a', 'value-a')

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})
