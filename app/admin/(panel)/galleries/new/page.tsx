import { GalleryForm } from "@/components/admin/Forms";
import { A } from "@/components/admin/copy";
import { Card, PageHead, Shell } from "@/components/admin/Shell";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "گالری جدید | پنل آینه‌رنگ", robots: { index: false } };

export default async function NewGallery() {
  const user = await requireAdmin();
  return (
    <Shell user={user} current="galleries">
      <PageHead title={A.newGallery} />
      <Card title={A.newGallery}>
        <div className="px-4 pb-5"><GalleryForm /></div>
      </Card>
    </Shell>
  );
}
