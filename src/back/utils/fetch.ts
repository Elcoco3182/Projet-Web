import { API_URL } from "../config.ts";

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 5,
  delay = 2000,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      // nosemgrep: javascript.lang.security.audit.ssrf.node-ssrf
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.log(`Réponse non-ok: ${res.status} pour ${url}`);
    } catch {
      console.log(`API non disponible, retry ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`API inaccessible après ${retries} tentatives`);
}

export { API_URL };
