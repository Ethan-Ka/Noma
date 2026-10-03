import { isMac } from '../platform'
import { MacOSAdapter } from './macAdapter'
import type { PlatformOSAdapter } from './types'
import { WindowsOSAdapter } from './windowsAdapter'

/** The foreground-app adapter for the OS Noma is running on. */
export function createOSAdapter(): PlatformOSAdapter {
  return isMac ? new MacOSAdapter() : new WindowsOSAdapter()
}
