import { useThemeStore } from './useThemeStore'

export function initStores(): void {
  void useThemeStore.getState()
}

export { useThemeStore }
