# SQL for the Supabase SQL Editor

`prisma/migrations/` is gitignored and kept locally, so migrations written in cloud sessions are committed here
instead. Run each file in the Supabase SQL Editor, in number order, after migrations `0`–`5`. Each file is
wrapped in a transaction and says how to record it with `prisma migrate resolve` afterwards.

| File | What it adds |
|------|--------------|
| `6_pos_teesheet_memberships_drawers.sql` | Booking source + check-in, SaleItem → Booking link, membership fields on User/Product, cash drawer sessions |
