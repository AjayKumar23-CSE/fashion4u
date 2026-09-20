-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HOME', 'OFFERS');

-- AlterTable
ALTER TABLE "banner" ADD COLUMN     "placement" "BannerPlacement" NOT NULL DEFAULT 'HOME';

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "size_chart" TEXT;
