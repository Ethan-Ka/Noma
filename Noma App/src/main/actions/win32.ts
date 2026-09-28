import koffi from 'koffi'

/**
 * The single place user32.dll gets loaded and its functions declared —
 * shared by windowFocus.ts, windowClose.ts, and systemCommands.ts so
 * there's one definition of each signature, not three.
 *
 * Why koffi: it's an FFI library with N-API prebuilt binaries (same
 * reasoning as better-sqlite3/uiohook-napi — no C++ toolchain on this
 * machine, no compilation on install). This replaces what used to be a
 * spawned PowerShell child process per action with a direct, synchronous
 * call from Flow's own process — see windowFocus.ts for why that
 * distinction is exactly what makes the redesigned focus mechanism safe.
 */
const user32 = koffi.load('user32.dll')

export const GetForegroundWindow = user32.func('intptr_t GetForegroundWindow()')
export const SetForegroundWindow = user32.func('bool SetForegroundWindow(intptr_t hwnd)')
export const IsWindow = user32.func('bool IsWindow(intptr_t hwnd)')
// user32.dll exports PostMessageW/PostMessageA, not "PostMessage" itself —
// that name is only a C-header macro that resolves to one or the other.
export const PostMessage = user32.func(
  'bool PostMessageW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)'
)
export const KeybdEvent = user32.func(
  'void keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)'
)

export const WM_CLOSE = 0x0010
export const KEYEVENTF_KEYUP = 0x0002

/**
 * Click replay (main/actions/click.ts) — resolving a stored `zone:<col>x<row>`
 * target back to a real screen point needs the target window's *current*
 * bounds (GetWindowRect), and firing the click itself needs real synthetic
 * mouse input (SetCursorPos + SendInput), not just keyboard. Declared here
 * rather than a second koffi.load('user32.dll') for the same reason every
 * other function in this file already lives in one place: one definition
 * per signature, not N.
 */
export const RECT = koffi.struct('RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t'
})
export const GetWindowRect = user32.func('bool GetWindowRect(intptr_t hwnd, _Out_ RECT *rect)')
export const SetCursorPos = user32.func('bool SetCursorPos(int32_t x, int32_t y)')

const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
  dx: 'long',
  dy: 'long',
  mouseData: 'uint32_t',
  dwFlags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t'
})
// KEYBDINPUT/HARDWAREINPUT members of the real Win32 union are never
// populated (mouse-only here), so the union only needs to declare the one
// member this file actually writes — koffi just needs the union's own
// layout to match the real INPUT struct's size for SendInput to read it
// correctly, not every member the OS header defines.
const INPUT = koffi.struct('INPUT', {
  type: 'uint32_t',
  u: koffi.union({ mi: MOUSEINPUT })
})
export const SendInput = user32.func(
  'unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)'
)
export const INPUT_SIZE = koffi.sizeof(INPUT)
export const INPUT_MOUSE = 0
export const MOUSEEVENTF_LEFTDOWN = 0x0002
export const MOUSEEVENTF_LEFTUP = 0x0004

/**
 * Holo's touch gate (main/holo/touchActivity.ts). A precision touchpad or
 * touchscreen reports every finger contact as a raw HID digitizer report,
 * even a touch that never moves the cursor or clicks. Those reports reach
 * no mouse hook, and this is the only way to see them.
 */
const RAWINPUTDEVICE = koffi.struct('RAWINPUTDEVICE', {
  usUsagePage: 'uint16_t',
  usUsage: 'uint16_t',
  dwFlags: 'uint32_t',
  hwndTarget: 'intptr_t'
})
const RAWINPUTHEADER = koffi.struct('RAWINPUTHEADER', {
  dwType: 'uint32_t',
  dwSize: 'uint32_t',
  hDevice: 'intptr_t',
  wParam: 'uintptr_t'
})
export const RegisterRawInputDevices = user32.func(
  'bool __stdcall RegisterRawInputDevices(RAWINPUTDEVICE *pRawInputDevices, uint32_t uiNumDevices, uint32_t cbSize)'
)
export const GetRawInputData = user32.func(
  'uint32_t __stdcall GetRawInputData(intptr_t hRawInput, uint32_t uiCommand, _Out_ RAWINPUTHEADER *pData, _Inout_ uint32_t *pcbSize, uint32_t cbSizeHeader)'
)
export const RAWINPUTDEVICE_SIZE = koffi.sizeof(RAWINPUTDEVICE)
export const RAWINPUTHEADER_SIZE = koffi.sizeof(RAWINPUTHEADER)
export const WM_INPUT = 0x00ff
export const RIDEV_REMOVE = 0x00000001
export const RIDEV_INPUTSINK = 0x00000100
export const RID_HEADER = 0x10000005
export const RIM_TYPEHID = 2
/** Buffer-based (not koffi structs): RID_DEVICE_INFO is a union whose HID
 *  member is read at fixed offsets in touchActivity.ts. */
export const GetRawInputDeviceList = user32.func(
  'uint32_t __stdcall GetRawInputDeviceList(void *pRawInputDeviceList, _Inout_ uint32_t *puiNumDevices, uint32_t cbSize)'
)
export const GetRawInputDeviceInfoW = user32.func(
  'uint32_t __stdcall GetRawInputDeviceInfoW(intptr_t hDevice, uint32_t uiCommand, void *pData, _Inout_ uint32_t *pcbSize)'
)
export const RAWINPUTDEVICELIST_SIZE = koffi.sizeof('intptr_t') * 2
export const RID_DEVICE_INFO_SIZE = 32
export const RIDI_DEVICENAME = 0x20000007
export const RIDI_DEVICEINFO = 0x2000000b
export const RIM_TYPEMOUSE = 0
export const HID_USAGE_PAGE_DIGITIZER = 0x0d
export const HID_USAGE_DIGITIZER_PEN = 0x02
export const HID_USAGE_DIGITIZER_TOUCH_SCREEN = 0x04
export const HID_USAGE_DIGITIZER_TOUCH_PAD = 0x05

/**
 * Which process owns a window — used by replay to confirm the app a learned
 * step expects is really the one in front before it clicks (see
 * windowProcess.ts). PROCESS_QUERY_LIMITED_INFORMATION is the least access
 * that can read an image name, and works for elevated processes too.
 */
const kernel32 = koffi.load('kernel32.dll')
export const GetWindowThreadProcessId = user32.func(
  'uint32_t __stdcall GetWindowThreadProcessId(intptr_t hwnd, _Out_ uint32_t *lpdwProcessId)'
)
export const OpenProcess = kernel32.func(
  'intptr_t __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)'
)
export const QueryFullProcessImageNameW = kernel32.func(
  'bool __stdcall QueryFullProcessImageNameW(intptr_t hProcess, uint32_t dwFlags, void *lpExeName, _Inout_ uint32_t *lpdwSize)'
)
export const CloseHandle = kernel32.func('bool __stdcall CloseHandle(intptr_t hObject)')
export const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

/** Which top-level window is at a screen point — replay checks a found
 *  control's point is really inside the expected app before clicking it
 *  (something else could be covering it). */
koffi.struct('POINT', { x: 'long', y: 'long' }) // registered by name for the signature below
export const WindowFromPoint = user32.func('intptr_t __stdcall WindowFromPoint(POINT point)')
export const GetAncestor = user32.func('intptr_t __stdcall GetAncestor(intptr_t hwnd, uint32_t gaFlags)')
export const GA_ROOT = 2
