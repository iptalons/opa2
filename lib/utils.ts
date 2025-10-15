
import { MAILTO, API_BASE } from '../constants';

export const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

export function extractId(idOrUrl?: string) {
  if (!idOrUrl) return "";
  try {
    const p = idOrUrl.split("/");
    return p[p.length - 1];
  } catch {
    return idOrUrl;
  }
}

export async function oaFetch(path: string, { signal }: { signal?: AbortSignal } = {}) {
  const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}mailto=${encodeURIComponent(
    MAILTO
  )}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAlex error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
