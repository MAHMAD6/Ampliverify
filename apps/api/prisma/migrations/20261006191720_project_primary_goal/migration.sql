-- CreateEnum
CREATE TYPE "project_goal" AS ENUM ('SEO', 'CONTENT', 'GEO', 'ALL');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "primary_goal" "project_goal";
