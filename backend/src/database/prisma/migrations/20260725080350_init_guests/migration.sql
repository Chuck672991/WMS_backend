-- CreateEnum
CREATE TYPE "GuestSide" AS ENUM ('BRIDE', 'GROOM', 'BOTH');

-- CreateEnum
CREATE TYPE "GatheringType" AS ENUM ('MARDANA', 'ZANANA', 'MIXED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupSize" INTEGER NOT NULL DEFAULT 1,
    "confirmedCount" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "side" "GuestSide" NOT NULL DEFAULT 'BOTH',
    "gathering" "GatheringType" NOT NULL DEFAULT 'MIXED',
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "rsvpToken" TEXT NOT NULL,
    "tableNumber" TEXT,
    "notes" TEXT,
    "lastInvitedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_event_invites" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_event_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guests_rsvpToken_key" ON "guests"("rsvpToken");

-- CreateIndex
CREATE INDEX "guests_weddingId_idx" ON "guests"("weddingId");

-- CreateIndex
CREATE INDEX "guests_weddingId_rsvpStatus_idx" ON "guests"("weddingId", "rsvpStatus");

-- CreateIndex
CREATE UNIQUE INDEX "guest_event_invites_guestId_eventId_key" ON "guest_event_invites"("guestId", "eventId");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_event_invites" ADD CONSTRAINT "guest_event_invites_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
