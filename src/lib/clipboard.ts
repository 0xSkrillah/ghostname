/**
 * Clipboard writes that never throw into the UI. navigator.clipboard is
 * absent on insecure origins (a plain-http LAN gateway) and writeText can be
 * rejected by the browser; both cases return an actionable message instead.
 */
export interface CopyResult {
  ok: boolean;
  error?: string;
}

export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return {
      ok: false,
      error: 'Clipboard is unavailable here (insecure origin). Select the text and copy it manually.',
    };
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Copy was blocked by the browser. Select the text and copy it manually.' };
  }
}
