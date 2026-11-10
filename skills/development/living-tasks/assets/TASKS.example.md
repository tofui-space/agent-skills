# Crumb tasks

Living task list for Crumb, the bakery pre-order app. Local only, never committed.
Format: 3
Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` waiting on Alex.
Details: Decided · Shipped · Spec · Evidence · Direction · Open
Labels: storefront · orders · bug
IDs: CRB · next CRB-12
Page: https://example.com/pages/crumb-tasks

## Now

- [x] CRB-1 #orders **Pickup slots fill up correctly.** A slot closes at 12 orders and the next free slot is offered instead.
  Commit 4e1c09a. Tests 88/88. Checked at 360 px and 1280 px in a headless browser (slots-check.mjs), and on a
  mid-size Android phone by Alex.
  - decided:: Alex 2026-03-02: "people keep showing up to a sold-out slot, close it at twelve."
  - shipped:: the slot list greys out a full slot and names the next free one ("Full, try 10:30").
  - evidence:: 12 orders placed in one slot by the test seed; the 13th was offered 10:30.
- [~] CRB-4 #storefront **Allergen info** on every product card. Data comes from `menu/allergens.json`; three products lack entries.
  - spec:: the 14 EU allergens, shown as words, never as icons alone.
  - direction:: a "Contains" line under the price; a product with no entry says "Allergens not listed yet".
- [ ] CRB-7 #orders **Order history** on the account screen (Alex asked 2026-03-03).
  - open:: keep orders for 12 months or for good?
- [ ] CRB-9 #orders #bug **Receipt times** show the pickup time in UTC.

## Queue (approved)

- [ ] CRB-2 **Gift cards.**
  - decided:: approved 2026-03-01.
- [ ] CRB-3 #storefront **Weekly specials banner.**

## Waiting on Alex

- [!] CRB-11 **Push main:** 4e1c09a pickup slots, 9b72f3e allergen data loader, `2604311` receipt times. Everything through
  51ac7d2 is pushed.
- [!] CRB-10 #storefront **Pick the allergen wording:** "Contains" or "Allergens".

## Red flags

Code to untangle before the next review:

- CRB-5 #orders `checkout.tsx` holds cart, slot and payment state in one component.
- CRB-6 Tests stub the payment provider by URL pattern.

## Later

- [ ] CRB-8 #storefront **Offline menu** for spotty shop Wi-Fi.
