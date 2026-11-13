import { useEffect } from 'react'

interface ShortcutBinding {
  keys: string[]
  action: () => void
  description: string
}

const SHORTCUTS: ShortcutBinding[] = [
  {
    keys: ['Ctrl+Enter'],
    action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })),
    description: 'Run query',
  },
  {
    keys: ['Ctrl+Shift+Enter'],
    action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true })),
    description: 'Run all statements',
  },
  {
    keys: ['Ctrl+/'],
    action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true })),
    description: 'Toggle comment',
  },
  {
    keys: ['Ctrl+B'],
    action: () => {
      const btn = document.querySelector('[data-action="toggle-schema"]') as HTMLButtonElement
      btn?.click()
    },
    description: 'Toggle schema panel',
  },
]

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`
      const binding = SHORTCUTS.find((s) => s.keys.includes(combo))
      if (binding) {
        e.preventDefault()
        binding.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
