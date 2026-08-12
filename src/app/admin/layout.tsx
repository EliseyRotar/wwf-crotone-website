import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/ToastProvider";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import itMessages from "@/i18n/messages/it.json";
import enMessages from "@/i18n/messages/en.json";
import "@/app/globals.css";

const messagesMap: Record<string, AbstractIntlMessages> = {
  it: itMessages as unknown as AbstractIntlMessages,
  en: enMessages as unknown as AbstractIntlMessages
};

async function getAdminLocale() {
  const store = await cookies();
  const lang = store.get("admin-lang")?.value;
  if (lang === "en" || lang === "it") return lang;
  return "it";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = await getAdminLocale();
  const messages = messagesMap[locale as "it" | "en"];
  const store = await cookies();
  const themeCookie = store.get("theme")?.value;
  const isDark = themeCookie === "dark";

  // Read the per-request CSP nonce minted by middleware (see
  // src/middleware.ts). Inline <script> tags must carry it, otherwise
  // the browser blocks them under the strict CSP we ship in production.
  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") ?? undefined;

  const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t){var c=document.cookie.match(/theme=(dark|light)/);t=c?c[1]:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

  if (!session) {
    return (
      <html lang="it" className={isDark ? "dark" : ""} suppressHydrationWarning>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body data-surface="admin" className="min-h-screen flex items-center justify-center p-6 bg-[var(--ad-bg)] text-[var(--ad-text)]">
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="it" className={isDark ? "dark" : ""} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-surface="admin" className="min-h-screen text-[var(--ad-text)]">
        <a href="#main" className="skip-link">Salta al contenuto</a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <AdminShell session={session}>{children}</AdminShell>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}