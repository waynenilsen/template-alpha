-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "avatar_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_id" TEXT,
ADD COLUMN     "name" TEXT;
