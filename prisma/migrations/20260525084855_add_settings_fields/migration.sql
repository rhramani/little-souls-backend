-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "company_address" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "favicon_url" TEXT;
