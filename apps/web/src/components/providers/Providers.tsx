import { ThemeProvider } from './ThemeProvider'
import { StoreProvider } from './StoreProvider'
import { ThemeWatcher } from './ThemeWatcher'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ThemeProvider>
        <ThemeWatcher />
        {children}
      </ThemeProvider>
    </StoreProvider>
  )
}
