export type SubmitResult = { ok: true } | { ok: false; error?: string; network?: boolean }

/** POSTs JSON to a Formspree-style endpoint. On a non-2xx answer, `error` is the
 *  endpoint's own message if it sent one; `network` is set when the request itself failed. */
export async function submitForm(endpoint: string, payload: Record<string, unknown>): Promise<SubmitResult> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => null)
    return { ok: false, error: data?.errors?.[0]?.message }
  } catch {
    return { ok: false, network: true }
  }
}
