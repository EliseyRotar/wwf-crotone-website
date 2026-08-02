import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * F8: Simple server-side search across published blog posts and FAQ items
 * (FAQ items come from i18n messages and are matched against localized strings).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const locale = searchParams.get("locale") === "en" ? "en" : "it";

  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const lower = q.toLowerCase();

  const [posts, faq] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
        published: true,
        OR: [
          { titleIt: { contains: q } },
          { titleEn: { contains: q } },
          { excerptIt: { contains: q } },
          { excerptEn: { contains: q } },
          { contentIt: { contains: q } },
          { contentEn: { contains: q } }
        ]
      },
      select: {
        slug: true,
        titleIt: true,
        titleEn: true,
        excerptIt: true,
        excerptEn: true,
        publishedAt: true
      },
      orderBy: { publishedAt: "desc" },
      take: 10
    }),
    loadFaq(locale, lower)
  ]);

  const results: { type: "post" | "faq"; title: string; snippet: string; href: string }[] = [
    ...posts.map((p) => ({
      type: "post" as const,
      title: locale === "en" ? (p.titleEn ?? p.titleIt) : p.titleIt,
      snippet: locale === "en" ? (p.excerptEn ?? p.excerptIt ?? "") : (p.excerptIt ?? ""),
      href: `/${locale}/blog/${p.slug}`
    })),
    ...faq
  ];

  return NextResponse.json({ ok: true, results });
}

async function loadFaq(locale: string, q: string) {
  try {
    const { getMessages } = await import("next-intl/server");
    const messages = await getMessages({ locale });
    const faqNs = (messages as {
      Faq?: { items?: { q: string; a: string }[]; groupedItems?: Record<string, { q: string; a: string }[]> };
    }).Faq;
    const flat: { q: string; a: string }[] = [];
    if (faqNs?.items) flat.push(...faqNs.items);
    if (faqNs?.groupedItems) {
      for (const list of Object.values(faqNs.groupedItems)) flat.push(...list);
    }
    const dedup = new Map<string, { q: string; a: string }>();
    for (const it of flat) if (!dedup.has(it.q)) dedup.set(it.q, it);
    return Array.from(dedup.values())
      .filter((it) => (it.q + " " + it.a).toLowerCase().includes(q))
      .slice(0, 5)
      .map((it) => ({
        type: "faq" as const,
        title: it.q,
        snippet: it.a.slice(0, 180),
        href: `/${locale}/faq`
      }));
  } catch {
    return [];
  }
}
