/**
 * Derived, not stored (Section: "Derived Status Logic"). Computed in the
 * service layer from SUM(VendorPayment.amount) vs Vendor.totalPrice.
 */
export enum VendorStatus {
  PENDING = 'PENDING',
  ADVANCE = 'ADVANCE',
  PAID = 'PAID',
}
