-- CreateEnum
CREATE TYPE "WeddingRole" AS ENUM ('OWNER', 'CO_OWNER', 'FAMILY_MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "weddings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3),
    "venueCity" TEXT,
    "estimatedGuests" INTEGER,
    "totalBudget" DECIMAL(12,2),
    "coverImageUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "weddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_members" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WeddingRole" NOT NULL DEFAULT 'FAMILY_MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wedding_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_invites" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WeddingRole" NOT NULL DEFAULT 'FAMILY_MEMBER',
    "invitedBy" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wedding_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wedding_members_userId_idx" ON "wedding_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_members_weddingId_userId_key" ON "wedding_members"("weddingId", "userId");

-- CreateIndex
CREATE INDEX "wedding_invites_weddingId_idx" ON "wedding_invites"("weddingId");

-- CreateIndex
CREATE INDEX "wedding_invites_email_idx" ON "wedding_invites"("email");

-- AddForeignKey
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_invites" ADD CONSTRAINT "wedding_invites_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
