import { useState } from 'react'

/**
 * A slot for a short, real screen recording of the app. Drop the files in
 * `public/media/` with the names below (see the README there). The slot
 * takes no space and shows nothing until the video has actually loaded, so
 * a missing file just leaves the page as it was. If the file isn't there at
 * build time, the slot isn't rendered at all (buildFlags.ts), so the page
 * makes no request for it. (On this host a missing
 * file comes back as the site's HTML, which the video element rejects,
 * which is the same "never loaded" case.)
 */
export const RECORDING_SRC = '/media/noma-notice-recording.mp4'
export const RECORDING_POSTER = '/media/noma-notice-recording-poster.jpg'

export default function ScreenRecording({ caption, className = '' }: { caption: string; className?: string }) {
  const [ready, setReady] = useState(false)

  // No file at build time: render nothing, so nothing is requested.
  if (!__HAS_RECORDING__) return null

  return (
    <figure className={ready ? className : 'pointer-events-none h-0 overflow-hidden opacity-0'} aria-hidden={!ready}>
      <video
        className="w-full rounded-[14px] border border-white/10 bg-base-900 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]"
        src={RECORDING_SRC}
        poster={RECORDING_POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={() => setReady(true)}
        onError={() => setReady(false)}
      />
      {ready && (
        <figcaption className="mt-4 text-center text-sm text-base-500">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
