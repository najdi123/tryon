-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_galleryId_fkey";

-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_lineId_fkey";

-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_shadeId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_galleryId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_qrTokenId_fkey";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "carried" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrEnteredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_lineId_type_createdAt_idx" ON "AnalyticsEvent"("lineId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "QrToken_galleryId_idx" ON "QrToken"("galleryId");

-- CreateIndex
CREATE INDEX "Session_qrTokenId_idx" ON "Session"("qrTokenId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_qrTokenId_fkey" FOREIGN KEY ("qrTokenId") REFERENCES "QrToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_shadeId_fkey" FOREIGN KEY ("shadeId") REFERENCES "Shade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

