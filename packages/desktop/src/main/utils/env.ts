import { platform } from 'os'

export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function getPlatform(): string {
  return platform()
}

export function getAppPath(): string {
  return process.env.NODE_ENV === 'production'
    ? process.resourcesPath
    : process.cwd()
}
