import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

/**
 * /[locale]/status — public status page.
 *
 * Strategy:
 *  1. If the Instatus subdomain is configured (CNAME live + page reachable),
 *     redirect there (it's the canonical source of truth for incidents).
 *  2. Otherwise render a self-hosted fallback that pings our own /api/health
 *     so visitors see real-time app status even when Instatus isn't set up.
 *
 * We check the Instatus subdomain via a short fetch (1.5s timeout) on the
 * server side; if it responds with 200, we redirect, otherwise we render
 * the fallback. The redirect target is configured via INSTATUS_URL env
 * (defaults to https://wwfcrotone.instatus.com for the live site).
 */
const INSTATUS_URL = process.env.INSTATUS_URL ?? "https://wwfcrotone.instatus.com";
const INSTATUS_CHECK_TIMEOUT_MS = 1500;

async function isInstatusReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INSTATUS_CHECK_TIMEOUT_MS);
    const res = await fetch(INSTATUS_URL, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export default async function StatusPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Try to redirect to Instatus if it's reachable. Fall back to self-hosted
  // status if not (e.g. Instatus subdomain not yet claimed, or Instatus is
  // itself down — which would be ironic but possible).
  const reachable = await isInstatusReachable();
  if (reachable) {
    redirect(INSTATUS_URL);
  }

  // Self-hosted fallback. The status data here is intentionally minimal:
  // - the URL of the page is `/[locale]/status` (we're rendering it)
  // - the API endpoint is `/api/health` (which we'll call from a client
  //   component for live data)
  // - we link to the Instatus signup so the visitor knows where the
  //   "real" status page lives once it's set up
  const t = await getTranslations({ locale, namespace: "status" });
  const instatusUrl = INSTATUS_URL;

  return (
    <main className="container section max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
      <p className="text-ink-grey mb-8">{t("subtitle")}</p>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{t("liveStatus")}</h2>
        <div id="status-indicator" className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-sm">{t("checking")}</span>
        </div>
        <noscript>
          <p className="text-sm text-ink-grey mt-2">{t("jsRequired")}</p>
        </noscript>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{t("incidents")}</h2>
        <p className="text-sm text-ink-grey">{t("noIncidents")}</p>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-2">{t("canonical")}</h2>
        <p className="text-sm text-ink-grey mb-2">{t("canonicalDesc")}</p>
        <a
          href={instatusUrl}
          className="text-wwf-green underline hover:no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {instatusUrl}
        </a>
      </div>

      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            (async () => {
              const el = document.getElementById('status-indicator');
              if (!el) return;
              try {
                const r = await fetch('/api/health', { cache: 'no-store' });
                const j = await r.json();
                const ok = j && j.ok && j.db === 'ok';
                el.innerHTML = ok
                  ? '<span class="inline-block h-3 w-3 rounded-full bg-green-500"></span><span class="text-sm font-medium">${t("operational")}</span>'
                  : '<span class="inline-block h-3 w-3 rounded-full bg-red-500"></span><span class="text-sm font-medium">${t("degraded")}</span>';
              } catch (e) {
                el.innerHTML = '<span class="inline-block h-3 w-3 rounded-full bg-yellow-500"></span><span class="text-sm">${t("unreachable")}</span>';
              }
            })();
          `,
        }}
      />
    </main>
  );
}