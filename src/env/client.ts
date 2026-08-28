/**
 * Client-side env validation.
 *
 * Only NEXT_PUBLIC_* vars go here. These get inlined into the client
 * bundle by Next.js, so they are PUBLIC — never put secrets here.
 *
 * If you try to import a server var from a client component, the
 * @t3-oss/env-nextjs Proxy throws.
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const clientEnv = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z
      .string()
      .url("NEXT_PUBLIC_SITE_URL must be a valid URL like https://wwfcrotone.it"),
    NEXT_PUBLIC_VERGARI_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional()
  },

  // MUST be an explicit destructure on client so Next.js inlines the
  // right vars. Don't use process.env directly — T3 Env needs the
  // explicit list to do the type narrowing.
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERGARI_URL: process.env.NEXT_PUBLIC_VERGARI_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  },

  // Client bundles never validate at build time (CI may not have
  // every var), so skipValidation is set globally via the server
  // module. T3 Env still validates the *types* at the import site.
  emptyStringAsUndefined: true
});
