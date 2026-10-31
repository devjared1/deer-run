# SQL for the Supabase SQL Editor

`prisma/migrations/` is gitignored and kept locally, so migrations written in cloud sessions are committed here
instead. Run each file in the Supabase SQL Editor, in number order, after migrations `0`–`5`. Each file is
wrapped in a transaction and says how to record it with `prisma migrate resolve` afterwards.

| File | What it adds |
|------|--------------|
| `4_pos_sales.sql`, `5_pos_approvals_refunds.sql` | **Reference copies** of migrations that were already run (source of `create_sale()` and `refund_sale()`). Don't run them again |
| `6_pos_teesheet_memberships_drawers.sql` | Booking source + check-in, SaleItem → Booking link, membership fields on User/Product, cash drawer sessions |
| `7_pos_card_payments.sql` | `CardCheckout` (Stripe Terminal sales), `SaleRefund.stripeRefundId`; `create_sale()` stores `Payment.stripePaymentIntentId` and `SaleItem.bookingId`, `refund_sale()` stores the Stripe refund |

When changing `create_sale()` or `refund_sale()`, start from the latest copy in this folder (currently `7_…`) and
`CREATE OR REPLACE` the whole function.
