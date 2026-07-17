import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import GalleryUploader from "@/components/admin/GalleryUploader";

export const dynamic = "force-dynamic";

export default async function GalleryAdminPage() {
  await requireSession();
  const items = await prisma.galleryItem.findMany({
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: { id: true, titleIt: true, category: true }
  });

  return (
    <div>
      <h1 className="text-3xl mb-1">Galleria</h1>
      <p className="text-ink-grey text-sm mb-8">Carica foto e video. I video richiedono l&apos;ID YouTube.</p>
      <GalleryUploader items={items.map((i) => ({ id: i.id, titleIt: i.titleIt, category: i.category }))} />
    </div>
  );
}