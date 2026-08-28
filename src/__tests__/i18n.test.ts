/**
 * i18n parity test.
 *
 * The public site is IT/EN bilingual, but the admin panel is IT-only
 * (WWF internal staff per AGENTS.md). Keys under `Admin.*` therefore
 * only need to exist in `it.json` — `en.json` may carry translations
 * opportunistically, but absence there is allowed.
 *
 * TODO: Once the admin panel becomes multilingual, drop the
 * `Admin.*` exception and require full parity across both locales.
 */

import { describe, it, expect } from "vitest";
import itMessages from "@/i18n/messages/it.json";
import enMessages from "@/i18n/messages/en.json";

type Messages = Record<string, unknown>;

function flatten(obj: Messages, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flatten(value as Messages, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n message parity (IT → EN)", () => {
  const itKeys = flatten(itMessages as Messages);
  const enKeys = flatten(enMessages as Messages);
  const enKeySet = new Set(enKeys);

  it("every IT key has a matching EN key, except Admin.* namespaces", () => {
    const missing = itKeys.filter((k) => !enKeySet.has(k));
    const nonAdminMissing = missing.filter((k) => !k.startsWith("Admin."));

    if (nonAdminMissing.length > 0) {
      throw new Error(
        `Missing EN translations for: ${nonAdminMissing
          .slice(0, 20)
          .join(", ")}${nonAdminMissing.length > 20 ? ` (+${nonAdminMissing.length - 20} more)` : ""}`
      );
    }

    expect(nonAdminMissing).toEqual([]);
  });
});