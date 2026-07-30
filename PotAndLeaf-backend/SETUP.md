# Pot & Leaf ERP — Backend setup (API-only, no teams, no Inertia)

This backend is now a **pure Laravel JSON API**. The starter-kit `teams` concept
and all Inertia code have been removed. Tenancy is a real **`companies`** table
(the Cheerakuzhy group's nursery companies), and every row is scoped by
`company_id`.

## Why your `migrate:fresh` failed — and why it's fixed

The error was:

```
Can't create table `potandleaf`.`suppliers` (errno: 150 "Foreign key constraint
is incorrectly formed") … foreign key (`team_id`) references `teams` (`id`)
```

`suppliers.team_id` was a bigint pointing at the kit's `teams.id`, whose id type
didn't match (the kit uses a non-bigint key), so MySQL rejected the FK. Every
`team_id` is now `company_id` → `companies.id` (both bigint), and there is a
`companies` migration that runs first. The mismatch is gone.

## One-time setup

1. **Sanctum + API routing** (if not already done):
   ```bash
   composer require laravel/sanctum
   php artisan install:api          # wires routes/api.php + publishes the tokens migration
   ```
   The included `app/Models/User.php` already has `Laravel\Sanctum\HasApiTokens`.

2. **Register the repository bindings** — add to `bootstrap/providers.php`:
   ```php
   App\Providers\RepositoryServiceProvider::class,
   ```

3. **Remove the kit baggage that you no longer use** (this is what caused the
   FK error and pulls in `teams`). Delete these if present:
   - every migration matching `*_create_teams_table`, `*_create_team_user_table`,
     `*_create_team_invitations_table`, `*_create_memberships_table`, and
     `*_add_current_team_id_to_users_table`
   - Inertia / Fortify / Jetstream service providers in `bootstrap/providers.php`
     (e.g. `FortifyServiceProvider`, `JetstreamServiceProvider`) — API-only doesn't need them
   - the `require __DIR__.'/nursery.php';` line in `routes/web.php`
     (a minimal API-only `routes/web.php` is included — use it)

   Keep: the framework's `users`, `cache`, `jobs` migrations and Sanctum's
   `personal_access_tokens` migration.

4. **Database** — set `.env` (`DB_DATABASE=potandleaf`, credentials), then:
   ```bash
   php artisan migrate:fresh --seed
   php artisan serve            # http://localhost:8000
   ```

## What the seeders create

`php artisan migrate:fresh --seed` runs, in order: permissions → companies →
admin user → admin roles → lookups → suppliers → products.

- **4 companies**: Cheerakuzhy HO, Calicut, Thrissur, Palakkad.
- **Admin user**: `admin@potandleaf.test` / `password`, with access to all four
  companies and an "Administrator" role (full `*` access) in each.
- **Per company**: product categories (Plants, Pots, Seeds, Fertilizers), brands,
  units (Nos/Kg/Bag), 3 suppliers, and 5 products. Products start at 0 stock so
  you can see purchases raise stock and low-stock alerts fire.

## Hitting the API

```bash
# 1) log in
curl -s http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@potandleaf.test","password":"password"}'
# → { data: { token, user, companies:[{id,name,code}] } }

# 2) use the token + pick a company (X-Company-Id) for scoped endpoints
curl -s http://localhost:8000/api/dashboard \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'X-Company-Id: 1'
```

The SPA does both automatically: it stores the token, shows a company switcher,
and sends `X-Company-Id` on every request.

## Run the SPA

```bash
cd potandleaf-spa
npm install
npm run dev            # http://localhost:5173  (proxies /api → :8000)
```

Sign in with the seeded admin, pick a company, and Suppliers / Products /
Purchases / Inventory / Purchase Returns are live.

---

## What's new in this build

**Modern theme.** The React SPA now follows the uploaded "Modern Theme" reference:
a cool green-grey canvas, soft sage-green accent, white cards floating on soft
shadows, Inter throughout, and rounded 18px corners. The change is at the design-token
and shared-primitive level, so every screen (dashboard, suppliers, purchases,
inventory, returns, counts) picks it up consistently.

**New module — Physical Stock Verification (Milestone 2).** A stock-count document
with an HO approval workflow:

- Create a count: system stock is snapshotted per product and you key in the
  physically counted quantity; variance is shown live.
- **draft → submitted → approved / rejected.** On **approve**, the variance posts to
  the same stock ledger (an `in`/`out` adjustment) so system stock lands exactly on
  the counted figure; the adjustment is recomputed against live stock at approval
  time. **Reject** records a reason and leaves stock untouched.
- New permissions: `stock_verifications.view`, `stock_verifications.create`
  (create + submit), `stock_verifications.approve` (approve/reject, i.e. HO).
- Endpoints: `GET /stock-verifications`, `GET /stock-verifications/form-data`,
  `POST /stock-verifications`, `GET /stock-verifications/{id}`,
  `POST /stock-verifications/{id}/{submit|approve|reject}`.

Because permissions are registry-driven, `php artisan migrate:fresh --seed` (or
re-running `PermissionSeeder` + re-syncing the admin role) grants the new ones
automatically.

### Milestone 2 status
Done: GST purchase entry + landed cost, stock ledger, reorder alerts, purchase
returns (debit note + reversal), **physical stock verification with HO approval**.
Still open: bulk unit splitting, CBM calculation. Then Milestone 3 (Production/BOM,
Stock Transfer with per-location stock, Plant Rental).

---

## Troubleshooting: `Route [login] not defined` (HTTP 500 on /api/*)

If any API call returns **500** with `"message": "Route [login] not defined."`,
the request reached the server **unauthenticated**, and the framework tried to
redirect to a `login` web page that doesn't exist in an API-only app. Fix — all
three are included in this package:

1. **Use the included `bootstrap/app.php`.** It returns a clean JSON **401**
   (`{"message":"Unauthenticated."}`) for `api/*` instead of the redirect, and
   wires `routes/api.php`. Also included: `bootstrap/providers.php` (registers
   `RepositoryServiceProvider`) and `routes/console.php`.

2. **Your browser token is stale after `migrate:fresh`.** Re-seeding wipes
   `personal_access_tokens`, so the token saved in the SPA's localStorage no
   longer exists in the DB → every request is unauthenticated. **Sign out and log
   in again** (or clear site data for localhost:5173). With the 401 fix above, the
   SPA now auto-redirects to /login when the token is stale, so this becomes
   self-healing.

3. **Point the SPA at your backend host.** You're running the API at
   `http://potandleaf-backend.test` (Herd), but the dev proxy defaulted to
   `http://localhost:8000`. `vite.config.js` now targets
   `http://potandleaf-backend.test` by default and is overridable — create a
   `.env` in `potandleaf-spa/` with `VITE_API_PROXY=http://localhost:8000` if you
   use `php artisan serve` instead. Restart `npm run dev` after changing it.

Quick check the API is up and auth works (should be **401 JSON**, never 500):
```bash
curl -i http://potandleaf-backend.test/api/suppliers          # → 401 {"message":"Unauthenticated."}
curl -s http://potandleaf-backend.test/api/login -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@potandleaf.test","password":"password"}'   # → { data: { token, ... } }
```

---

## What's new: Products/Barcode + Multi-Company & Access Control (Module 14)

**Product Master (SPA).** Full create/edit/delete for products with pricing, tax,
reorder level, and an **auto-generated Code128 barcode** (printable label; barcode
search works from the products list).

**Companies (HO super admin).** `admin@potandleaf.test` is now a **super admin** who
can add / edit / delete companies and manage users in any of them (menu: Companies).
Every company keeps its own products, suppliers, purchases, inventory, users and
roles — isolation is enforced by `company_id` on every query.

**Users & roles per company.** Each user is a real login (email + password) attached
to a company with one role. Roles carry a permission matrix (grouped by module) you
can edit. Deactivated users can't sign in. Seeded roles per company: Administrator
(full), Manager, Cashier, Godown Staff, Supervisor, Salesman.

**Inline validation.** Forms now show validation errors **under each field** (company,
user, role, and product forms), not just a banner.

After pulling this build, re-run `php artisan migrate:fresh --seed` (new columns:
`users.is_super_admin/phone/is_active`; new permissions for users/roles). Then sign in
fresh — the stale-token behaviour from the troubleshooting section applies.

### Endpoints added
`GET/POST/PUT/DELETE /companies` (super admin), `/users` (+ `/users/form-data`),
`/roles` (+ `/roles/form-data`), and full `/products` CRUD (+ `/products/form-data`).

---

## Modules 1 & 2 completed

**Purchase Management (Module 01)** now also has:
- **Bulk Splitting** — convert a bulk product (e.g. a 25 kg bag) into sellable units,
  with the bulk's cost **redistributed by qty × weight** across the outputs (exact to
  the paisa). Confirming posts stock: source out, outputs in, output cost prices
  refreshed. Endpoints: `/bulk-splits` (+ `form-data`, `{id}/confirm`, `DELETE`).
- **CBM / container planning** — product dimensions (L×W×H cm) feed a live **total CBM**
  and a **container fill %** indicator on the purchase entry form.
- **Sales-rate suggestion** — on the product form, enter a margin % to auto-fill
  retail/MRP from cost.

**Inventory Management (Module 04)** now has **Stock Reports** as tabs on the Inventory
screen: **Valuation** (stock × cost, with totals) and **Fast / Slow / Dead** movement
classification over a 30/60/90-day window — plus the existing live stock levels,
reorder alerts, and per-product ledger.

New permissions: `bulk_splits.view/create/confirm/delete`. Re-run
`php artisan migrate:fresh --seed` (new tables: `bulk_splits`, `bulk_split_items`;
new product columns `length_cm/width_cm/height_cm`).

### Still deferred to Milestone 3 (correctly, not skipped)
Per-location **in-transit** and **rental** stock buckets depend on Stock Transfer and
Plant Rental — those are Module 05/06 and will land with Milestone 3. Purchase-list PDF
export is a small follow-up.

---

## Detail pages + Customer master

**Detail pages.** Records are now viewable, not just editable. Click the name/number
in any list to open a full detail page: **Purchase** (GRN with line items, GST split,
landed cost, totals + confirm/cancel/edit), **Purchase Return** (debit-note breakdown),
**Stock Count** (counted items + variance, with submit/approve/reject), **Bulk Split**
(source + outputs with cost allocation), **Supplier**, **User**, and **Customer**.
Document actions live on the detail page; master records show an Edit shortcut.

**Customer master (Module 12).** New `customers` table and full CRUD, mirroring
suppliers: types (retail / wholesale / dealer), GST, contact + WhatsApp, address,
credit terms, opening balance, outstanding, and loyalty points (for the future
loyalty module). Inline-validated create/edit + detail page. Permissions
`customers.view/create/update/delete`; seeded 3 customers per company. This is the
foundation the Sales/POS and Loyalty modules will build on.

Re-run `php artisan migrate:fresh --seed` (new table `customers`).

---

## Sales / POS (Module 03)

Point-of-sale billing that reuses the Customer master, Products, Inventory and GST.
- **POS entry** — pick a customer (or Walk-in), add product lines. The rate auto-fills
  from the customer's **pricing tier** (retail / wholesale / dealer) and is editable.
  Live GST split (CGST+SGST or IGST), per-line discount, and a **round-off** to the
  nearest rupee. Super admins get a "billing for company" picker.
- **Confirm** posts stock **out** (COGS at product cost), and for a chosen customer
  updates **outstanding** (credit sales) and **loyalty points** (1 per ₹100). Cancel
  reverses all of it. Draft → confirmed → cancelled, guarded against overselling.
- **List + invoice detail** with full line items and totals.

Permissions `sales.view/create/confirm/delete` are seeded to Manager, Cashier and
Salesman roles (which also now get Customers access). Endpoints: `/sales`
(+ `form-data`, `{id}/confirm`, `DELETE`). Re-run `php artisan migrate:fresh --seed`
(new tables `sales`, `sale_items`).

---

## Supplier Payment Tracking (Module 08)

Payables now flow end to end. Confirming a purchase **adds its total to the
supplier's outstanding**; cancelling reverses it. A new **Payments** screen records
payments against a supplier (and optionally allocates them to a specific GRN):

- **Record payment** — pick a supplier (shows current outstanding), optionally choose
  an unpaid/partly-paid GRN (auto-fills the balance), enter amount, mode
  (cash / bank / UPI / cheque) and a UTR/cheque reference. Recording it decreases the
  supplier's outstanding and increases the GRN's paid amount; deleting reverses both.
- **Purchase payment status** — purchases now show **paid / partial / unpaid** badges
  and a Paid/Balance breakdown on the detail page.

Permissions `payments.view/create/delete` (seeded to Manager). Endpoints:
`/supplier-payments` (+ `form-data`, `DELETE`). Re-run `php artisan migrate:fresh --seed`
(new table `supplier_payments`, new column `purchases.amount_paid`).

---

## Supplier Payment Tracking (Module 08)

Money owed to suppliers, tracked per GRN. Confirming a purchase already raises the
supplier's outstanding; this module records payments that draw it down.
- **Payables tab** — every confirmed purchase with invoice total, **paid**, **balance**,
  a **due date** (purchase date + supplier credit days), and a **paid / partial / unpaid**
  status. A "Pay" button opens the record form pre-filled for that GRN.
- **Record payment** — pick a supplier (shows current outstanding), optionally allocate
  to a specific GRN, enter amount / mode (cash, bank, UPI, cheque) / date / reference.
  Recording reduces the supplier's outstanding; voiding a payment restores it.
- **Payment history tab** — all recorded payments, with void.

Permissions `payments.view/create/delete` (seeded to Manager). Endpoints:
`/supplier-payments` (+ `form-data`, `payables`, `DELETE`). Re-run
`php artisan migrate:fresh --seed` (new table `supplier_payments`).

---

## Customer Receipts (receivables)

The receivables mirror of supplier payments. A credit sale already raises the
customer's outstanding at confirm; receipts draw it down.
- **Receivables tab** — confirmed credit sales with credit amount, **received**,
  **balance**, due date (sale date + customer credit days) and paid/partial/unpaid
  status. A "Collect" button pre-fills the receipt form for that invoice.
- **Record receipt** — pick a customer (shows outstanding), optionally allocate to an
  invoice, enter amount / mode (cash, bank, UPI, cheque, card) / date / reference.
  Recording reduces outstanding; voiding restores it.
- **Receipt history tab** with void.

Permissions `receipts.view/create/delete` (seeded to Manager + Cashier). Endpoints:
`/customer-receipts` (+ `form-data`, `receivables`, `DELETE`). Re-run
`php artisan migrate:fresh --seed` (new table `customer_receipts`).
