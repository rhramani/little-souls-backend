-- AlterTable
ALTER TABLE "products" ADD COLUMN     "catalogue_id" UUID;

-- CreateTable
CREATE TABLE "catalogues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogues_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_catalogue_id_fkey" FOREIGN KEY ("catalogue_id") REFERENCES "catalogues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
