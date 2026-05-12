/*
  Warnings:

  - You are about to drop the column `profile_id` on the `object_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `profiles` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[team_id,object_name]` on the table `object_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[google_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `team_id` to the `object_permissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "object_permissions" DROP CONSTRAINT "object_permissions_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_profile_id_fkey";

-- DropIndex
DROP INDEX "object_permissions_profile_id_object_name_key";

-- AlterTable
ALTER TABLE "object_permissions" DROP COLUMN "profile_id",
ADD COLUMN     "team_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "profile_id",
ADD COLUMN     "google_domain" TEXT,
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "phone" TEXT;

-- DropTable
DROP TABLE "profiles";

-- CreateTable
CREATE TABLE "console_apps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "required_capability" TEXT,

    CONSTRAINT "console_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "console_menus" (
    "id" UUID NOT NULL,
    "app_id" UUID,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "path" TEXT,
    "action_type" TEXT NOT NULL DEFAULT 'table',
    "parent_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required_capability" TEXT,
    "component_key" TEXT,

    CONSTRAINT "console_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_system_admin" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" UUID,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_permissions" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "capability" TEXT NOT NULL,

    CONSTRAINT "system_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_teams" (
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_teams_pkey" PRIMARY KEY ("user_id","team_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "console_apps_tenant_id_name_key" ON "console_apps"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "system_permissions_team_id_capability_key" ON "system_permissions"("team_id", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "object_permissions_team_id_object_name_key" ON "object_permissions"("team_id", "object_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- AddForeignKey
ALTER TABLE "console_apps" ADD CONSTRAINT "console_apps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "console_menus" ADD CONSTRAINT "console_menus_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "console_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "console_menus" ADD CONSTRAINT "console_menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "console_menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_permissions" ADD CONSTRAINT "object_permissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_permissions" ADD CONSTRAINT "system_permissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
