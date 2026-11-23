import { useCallback, useRef, useSyncExternalStore } from 'react'

type Listener = () => void

/** A tiny observable value. State is treated as immutable: always `set` a new object. */
export class Store<T> {
  private state: T
  private listeners = new Set<Listener>()

  constructor(initial: T) {
    this.state = initial
  }

  get = (): T => this.state

  set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === 'function' ? (next as (prev: T) => T)(this.state) : next
    if (Object.is(value, this.state)) return
    this.state = value
    for (const l of [...this.listeners]) l()
  }

  update = (patch: Partial<T>) => this.set((s) => ({ ...s, ...patch }))

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  return true
}

/**
 * Subscribe a component to a slice of a store. The selector may return a fresh
 * array/object each time; results are compared with `equal` (shallow by default)
 * so the component only re-renders when the slice really changes.
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S, equal: (a: S, b: S) => boolean = shallowEqual): S {
  const cache = useRef<{ state: T; selector: (state: T) => S; value: S } | null>(null)
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const getSnapshot = useCallback(() => {
    const state = store.get()
    const selector = selectorRef.current
    const c = cache.current
    // Selectors are usually inline closures, so key the cache on both state and selector.
    if (c && c.state === state && c.selector === selector) return c.value
    const value = selector(state)
    if (c && equal(c.value, value)) {
      cache.current = { state, selector, value: c.value }
      return c.value
    }
    cache.current = { state, selector, value }
    return value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
