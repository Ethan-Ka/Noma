import {
  CloseHandle,
  GetWindowThreadProcessId,
  OpenProcess,
  PROCESS_QUERY_LIMITED_INFORMATION,
  QueryFullProcessImageNameW
} from './win32'

export interface WindowProcess {
  pid: number
  /** Executable file name, e.g. "Resolve.exe". */
  processName: string
}

/** The process that owns `hwnd`, or null if it can't be read. Never throws. */
export function processForWindow(hwnd: number): WindowProcess | null {
  try {
    const pid = [0]
    GetWindowThreadProcessId(hwnd, pid)
    if (!pid[0]) return null
    const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid[0])
    if (!handle) return { pid: pid[0], processName: '' }
    try {
      const chars = [1024]
      const buffer = Buffer.alloc(chars[0] * 2)
      if (!QueryFullProcessImageNameW(handle, 0, buffer, chars)) return { pid: pid[0], processName: '' }
      const path = buffer.toString('utf16le', 0, chars[0] * 2)
      return { pid: pid[0], processName: path.split(/[\\/]/).pop() ?? '' }
    } finally {
      CloseHandle(handle)
    }
  } catch {
    return null
  }
}

/** Whether an executable name matches an application's stored process name
 *  ("chrome" and "chrome.exe" are the same process; case never matters). */
export function sameProcess(actual: string, expected: string): boolean {
  const bare = (name: string): string => name.trim().toLowerCase().replace(/\.exe$/, '')
  return bare(actual) !== '' && bare(actual) === bare(expected)
}
