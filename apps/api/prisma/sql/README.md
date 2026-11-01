# SQL for the Supabase SQL Editor

`prisma/migrations/` is gitignored and kept locally, so migrations written in cloud sessions are committed here
instead. Run each file in the Supabase SQL Editor, in number order, after migrations `0`–`5`. Each file is
wrapped in a transaction and says how to record it with `prisma migrate resolve` afterwards.

| File | What it adds |
|------|--------------|
| `4_pos_sales.sql`, `5_pos_approvals_refunds.sql` | **Reference copies** of migrations that were already run (source of `create_sale()` and `refund_sale()`). Don't run them again |
| `6_pos_teesheet_memberships_drawers.sql` | Booking source + check-in, SaleItem → Booking link, membership fields on User/Product, cash drawer sessions |
| `7_pos_card_payments.sql` | `CardCheckout` (Stripe Terminal sales), `SaleRefund.stripeRefundId`; `create_sale()` stores `Payment.stripePaymentIntentId` and `SaleItem.bookingId`, `refund_sale()` stores the Stripe refund |
| `8_pos_house_accounts.sql` | `HouseAccount`, `HouseAccountEntry`, `Statement`; `create_sale()` charges house accounts (locked, limit-checked) and `refund_sale()` credits them |
| `9_guest_default_discounts_tips_drawers.sql` | `User.role` defaults to GUEST; `ProductCategory.memberDiscount`, `SaleItem.memberDiscountCents`; card tips (`CourseSettings.tipping*`, `Payment.tipCents`); late fees (`CourseSettings.lateFeeCents`, `Statement.reminderSentAt/lateFeeAt`); `CashDrawerMovement` + approval actions; `save_time_entry()` |
| `11_rates.sql` | Greens fee / cart rates as tagged products (`Product.rateKey`), `CourseSettings.holidayDates`, `Booking.cartIncluded`; creates or links the rate products at the starting rates and deactivates the old Twilight / 9 Holes products |
| `10_on_course_tracking.sql` | On-course tracking: `Booking` cart numbers, start hole, 9/18 holes, tee-off, last position (`HoleStage`) and finish; `PositionReport` (every report); `CourseSettings.roundMinutes`, `coursePositions`, learned `holeSeconds` |

When changing `create_sale()` or `refund_sale()`, start from the latest copy in this folder (currently `8_…`) and
`CREATE OR REPLACE` the whole function.
