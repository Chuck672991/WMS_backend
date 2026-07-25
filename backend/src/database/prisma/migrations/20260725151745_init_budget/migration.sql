-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('CATERING', 'DECORATION', 'DRESSES', 'JEWELLERY', 'PHOTOGRAPHY', 'VENUE', 'TRANSPORT', 'INVITATION_CARDS', 'SALON_MAKEUP', 'GIFTS', 'MISCELLANEOUS', 'OTHER');

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "customCategory" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT,
    "vendorPaymentId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_vendorPaymentId_key" ON "budget_items"("vendorPaymentId");

-- CreateIndex
CREATE INDEX "budget_items_weddingId_idx" ON "budget_items"("weddingId");

-- CreateIndex
CREATE INDEX "budget_items_weddingId_category_idx" ON "budget_items"("weddingId", "category");

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
