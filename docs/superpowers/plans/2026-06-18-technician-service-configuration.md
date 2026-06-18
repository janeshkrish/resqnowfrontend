# Technician Service Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add registration-compatible, service-specific technician pricing to the admin technician page and use exact service-and-vehicle pricing for customer technician estimates.

**Architecture:** Keep the complete nested pricing document in `technicians.service_costs` and derive one normalized `technician_services` row per service and vehicle. Add pure backend and frontend conversion/resolution modules, then keep the route and React page as orchestration layers. Existing technician registration code remains unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Express, Node test runner, MySQL/TiDB.

---

## File Map

### Backend repository (`../resqnowbackend`)

- Create `services/technicianPriceDisplay.js`: exact service/vehicle row selection and card estimate calculation.
- Create `services/adminTechnicianServiceConfiguration.js`: preserve/canonicalize the nested pricing document and derive the selected service list and primary service.
- Create `tests/technician_pricing.test.js`: normalization, metadata, price resolution, and configuration document tests.
- Modify `models/technicianPricing.js`: derive flat-tire minimum puncture pricing from nested metadata and retain all nested fields.
- Modify `routes/admin.js`: save specialties, primary service, nested profile JSON, and normalized rows in one transaction.
- Modify `routes/technicians.js`: return nested profile pricing to admins and resolve nearby prices from bulk-loaded normalized rows.
- Modify `package.json`: add the focused technician-pricing test command.

### Frontend repository (`.`)

- Create `src/config/adminTechnicianServicePricingCatalog.ts`: admin-only copy of the PDF field definitions; technician registration remains untouched.
- Create `src/utils/adminTechnicianServiceConfiguration.ts`: pure parser, hydration, service synchronization, legacy conversion, and payload builder.
- Create `src/utils/adminTechnicianServiceConfiguration.test.ts`: utility regression tests.
- Create `src/components/admin/AdminTechnicianServiceConfiguration.tsx`: service-specific editor for towing, flat-tire, and standard services.
- Modify `src/pages/admin/TechnicianDetails.tsx`: replace generic rows and connect the new save contract.
- Modify `package.json`: add a non-watch Vitest command if one is not present.

## Task 1: Backend Nested Pricing and Display Resolver

**Files:**

- Create: `../resqnowbackend/tests/technician_pricing.test.js`
- Create: `../resqnowbackend/services/technicianPriceDisplay.js`
- Modify: `../resqnowbackend/models/technicianPricing.js`
- Modify: `../resqnowbackend/package.json`

- [ ] **Step 1: Write failing normalization and display-price tests**

Create tests with real nested pricing objects:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTechnicianPricingEntries } from "../models/technicianPricing.js";
import { resolveTechnicianDisplayPrice } from "../services/technicianPriceDisplay.js";

const flatTireDocument = [{
  service_domain: "flat-tire",
  vehicle_categories: ["bike", "car"],
  flat_tire_vehicle_pricing: {
    bike: {
      visit_charge: 120,
      free_distance: 3,
      extra_km_charge: 20,
      selected_subcategories: ["scooter"],
      subcategories: {
        scooter: { label: "Scooter", tube_tyre_price: 180, tubeless_price: 220 },
      },
    },
    car: {
      visit_charge: 150,
      selected_subcategories: ["hatchback"],
      subcategories: {
        hatchback: { label: "Hatchback", tube_tyre_price: 300, tubeless_price: 350 },
      },
    },
  },
}];

test("normalizes nested flat-tire pricing without dropping subcategories", () => {
  const rows = normalizeTechnicianPricingEntries(flatTireDocument);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].service_domain, "flat-tire");
  assert.equal(rows[0].service_charge, 180);
  assert.equal(rows[0].metadata.subcategories.scooter.tubeless_price, 220);
});

test("flat-tire display price is visit charge plus the lowest puncture price", () => {
  const rows = normalizeTechnicianPricingEntries(flatTireDocument);
  const result = resolveTechnicianDisplayPrice(rows, {
    serviceType: "flat-tire",
    vehicleType: "bike",
  });
  assert.deepEqual(result, {
    price: 300,
    service_domain: "flat-tire",
    vehicle_type: "bike",
    breakdown: { visit_charge: 120, puncture_price: 180 },
  });
});

test("does not use a different vehicle category as a fallback", () => {
  const rows = normalizeTechnicianPricingEntries(flatTireDocument);
  assert.equal(resolveTechnicianDisplayPrice(rows, {
    serviceType: "flat-tire",
    vehicleType: "commercial",
  }), null);
});

test("standard service display price adds service and visit charges", () => {
  const result = resolveTechnicianDisplayPrice([{
    service_domain: "battery",
    vehicle_type: "car",
    service_charge: 350,
    visit_charge: 120,
    metadata: {},
  }], { serviceType: "battery", vehicleType: "car" });
  assert.equal(result.price, 470);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```powershell
node --test tests/technician_pricing.test.js
```

Expected: FAIL because `technicianPriceDisplay.js` does not exist and nested flat-tire rows do not derive a puncture price.

- [ ] **Step 3: Implement minimum puncture extraction and exact row resolution**

In `models/technicianPricing.js`, derive candidate prices only from selected subcategories, set `service_charge` to the minimum candidate when no explicit service charge exists, and keep the vehicle object as metadata. In `technicianPriceDisplay.js`, export:

```js
export function resolveTechnicianDisplayPrice(rows, { serviceType, vehicleType })
```

It must canonicalize both keys, select only an exact vehicle row, return visit plus puncture for flat-tire, service plus visit for standard services, delivery charge for fuel, and base price for towing. Missing required amounts return `null`.

- [ ] **Step 4: Add and run the focused test command**

Add:

```json
"test:technician-pricing": "node --test tests/technician_pricing.test.js"
```

Run:

```powershell
npm run test:technician-pricing
```

Expected: PASS with four tests.

- [ ] **Step 5: Commit Task 1**

```powershell
git add models/technicianPricing.js services/technicianPriceDisplay.js tests/technician_pricing.test.js package.json
git commit -m "feat: resolve technician service display pricing"
```

## Task 2: Backend Configuration Document and Transactional Save

**Files:**

- Create: `../resqnowbackend/services/adminTechnicianServiceConfiguration.js`
- Modify: `../resqnowbackend/tests/technician_pricing.test.js`
- Modify: `../resqnowbackend/routes/admin.js`

- [ ] **Step 1: Add failing configuration-document tests**

Append tests that assert:

```js
import { normalizeTechnicianServiceConfiguration } from "../services/adminTechnicianServiceConfiguration.js";

test("preserves nested pricing while canonicalizing selected services", () => {
  const result = normalizeTechnicianServiceConfiguration({
    services: ["Flat Tire Repair", "battery", "battery"],
    serviceCosts: flatTireDocument,
    existingPrimaryService: "flat-tire",
  });
  assert.deepEqual(result.services, ["flat-tire", "battery"]);
  assert.equal(result.primaryService, "flat-tire");
  assert.equal(result.serviceCosts[0].flat_tire_vehicle_pricing.bike.subcategories.scooter.tube_tyre_price, 180);
});

test("drops pricing entries for services removed by the admin", () => {
  const result = normalizeTechnicianServiceConfiguration({
    services: ["battery"],
    serviceCosts: [...flatTireDocument, { service_domain: "battery", vehicle_categories: [] }],
    existingPrimaryService: "flat-tire",
  });
  assert.deepEqual(result.services, ["battery"]);
  assert.equal(result.primaryService, "battery");
  assert.deepEqual(result.serviceCosts.map((entry) => entry.service_domain), ["battery"]);
});
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npm run test:technician-pricing
```

Expected: FAIL because the configuration module does not exist.

- [ ] **Step 3: Implement canonical document normalization**

Create `normalizeTechnicianServiceConfiguration` to parse JSON safely, canonicalize and deduplicate services, keep nested entries unchanged except canonical `service_name`/`service_domain`, filter removed services, and derive the primary service deterministically.

- [ ] **Step 4: Extend the existing admin pricing endpoint**

Update `PUT /api/admin/technician/:id/pricing` so it:

```js
const configuration = normalizeTechnicianServiceConfiguration({
  services: req.body?.services ?? existingServices,
  serviceCosts: serviceCostsInput,
  existingPrimaryService: existing.service_type,
});

await replaceTechnicianPricingRows(conn, technicianId, configuration.serviceCosts);
await conn.execute(
  `UPDATE technicians
      SET specialties = ?, service_type = ?, service_costs = ?
    WHERE id = ?`,
  [
    JSON.stringify(configuration.services),
    configuration.primaryService,
    JSON.stringify(configuration.serviceCosts),
    technicianId,
  ]
);
```

Keep the existing transaction boundaries and preserve the old contract by retaining existing services when `services` is omitted.

- [ ] **Step 5: Run backend tests and syntax build**

```powershell
npm run test:technician-pricing
npm run build
```

Expected: PASS and build-check exit code 0.

- [ ] **Step 6: Commit Task 2**

```powershell
git add services/adminTechnicianServiceConfiguration.js tests/technician_pricing.test.js routes/admin.js
git commit -m "feat: save technician service configuration transactionally"
```

## Task 3: Preserve Nested Admin Details and Use Bulk Runtime Pricing

**Files:**

- Modify: `../resqnowbackend/routes/technicians.js`
- Modify: `../resqnowbackend/tests/technician_pricing.test.js`

- [ ] **Step 1: Add a failing pricing-index test**

Test a pure exported helper from `technicianPriceDisplay.js`:

```js
import { indexTechnicianPricingRows } from "../services/technicianPriceDisplay.js";

test("indexes rows by technician, service, and vehicle", () => {
  const index = indexTechnicianPricingRows([
    { technician_id: 930001, service_domain: "flat-tire", vehicle_type: "bike" },
    { technician_id: 930001, service_domain: "flat-tire", vehicle_type: "car" },
  ]);
  assert.equal(index.get(930001).length, 2);
});
```

- [ ] **Step 2: Run and confirm RED, then implement the index helper**

```powershell
npm run test:technician-pricing
```

Expected before implementation: FAIL because the export is missing. Implement it and rerun to PASS.

- [ ] **Step 3: Stop flattening valid admin profile pricing**

In `GET /api/technicians/:id`, parse `row.service_costs`. Only reconstruct from `technician_services` when the profile document is missing or invalid. Include metadata in the fallback query and mapping.

- [ ] **Step 4: Bulk-load exact pricing in `/nearby`**

After loading approved technicians, load all matching `technician_services` rows with one `IN (...)` query. Index them by technician ID, replace the current fuzzy profile-price block with `resolveTechnicianDisplayPrice`, and return:

```js
{
  ...technician,
  price: resolved?.price ?? null,
  base_price: resolved?.price ?? null,
  price_breakdown: resolved?.breakdown ?? null,
  currency,
}
```

If a technician has no normalized rows, normalize that technician's profile `service_costs` as a legacy fallback. Never select another vehicle category.

- [ ] **Step 5: Run backend verification**

```powershell
npm run test:technician-pricing
npm run test:towing-phase2
npm run build
```

Expected: all tests pass and build-check exits 0.

- [ ] **Step 6: Commit Task 3**

```powershell
git add routes/technicians.js services/technicianPriceDisplay.js tests/technician_pricing.test.js
git commit -m "feat: return exact nearby technician prices"
```

## Task 4: Frontend Service Catalog and Pure Configuration Utilities

**Files:**

- Create: `src/config/adminTechnicianServicePricingCatalog.ts`
- Create: `src/utils/adminTechnicianServiceConfiguration.ts`
- Create: `src/utils/adminTechnicianServiceConfiguration.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing utility tests**

Cover parsing, card creation, preservation, and payload generation:

```ts
import { describe, expect, it } from "vitest";
import {
  hydrateAdminServicePricing,
  parseAdminServiceTokens,
  syncAdminServicePricing,
  buildAdminServicePricingPayload,
} from "./adminTechnicianServiceConfiguration";

const flatTireDocument = [{
  service_domain: "flat-tire",
  vehicle_categories: ["bike"],
  flat_tire_vehicle_pricing: {
    bike: {
      visit_charge: 120,
      free_distance: 3,
      extra_km_charge: 20,
      selected_subcategories: ["scooter"],
      subcategories: {
        scooter: { label: "Scooter", tube_tyre_price: 180, tubeless_price: 220 },
      },
    },
  },
}];

describe("admin technician service configuration", () => {
  it("canonicalizes and deduplicates comma-separated services", () => {
    expect(parseAdminServiceTokens("flat tire, battery, flat-tire")).toEqual(["flat-tire", "battery"]);
  });

  it("creates a flat-tire editor for the technician vehicle categories", () => {
    const entries = syncAdminServicePricing([], ["flat-tire"], ["bike"]);
    expect(entries[0].service_domain).toBe("flat-tire");
    expect(entries[0].vehicle_categories).toEqual(["bike"]);
    expect(entries[0].flat_tire_vehicle_pricing.bike.subcategories).toEqual({});
  });

  it("preserves nested submitted puncture prices", () => {
    const entries = hydrateAdminServicePricing(flatTireDocument, ["flat-tire"], ["bike"]);
    expect(entries[0].flat_tire_vehicle_pricing.bike.subcategories.scooter.tubeless_price).toBe(220);
  });

  it("builds registration-compatible nested service costs", () => {
    const entries = hydrateAdminServicePricing(flatTireDocument, ["flat-tire"], ["bike"]);
    const payload = buildAdminServicePricingPayload(entries);
    expect(payload[0].service_domain).toBe("flat-tire");
    expect(payload[0].flat_tire_vehicle_pricing.bike.subcategories.scooter.tube_tyre_price).toBe(180);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Add:

```json
"test": "vitest run"
```

Run:

```powershell
npm test -- src/utils/adminTechnicianServiceConfiguration.test.ts
```

Expected: FAIL because the catalog and utility do not exist.

- [ ] **Step 3: Implement the admin-only catalog**

Define the eight canonical services, four vehicle types, towing fleets, flat-tire subcategories, service labels, and standard fields exactly as listed in the approved design. Do not change or import-edit `TechnicianSignupWizard.tsx`.

- [ ] **Step 4: Implement pure configuration utilities**

Export strongly typed functions for token parsing, nested hydration, legacy flat-row grouping, service synchronization, vehicle category toggling, and payload pruning. Use `canonicalizeServiceKey`, `canonicalizeVehicleKey`, and the existing `buildSignupPricingPayload` output rules without modifying registration behavior.

- [ ] **Step 5: Run focused frontend tests**

```powershell
npm test -- src/utils/adminTechnicianServiceConfiguration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/config/adminTechnicianServicePricingCatalog.ts src/utils/adminTechnicianServiceConfiguration.ts src/utils/adminTechnicianServiceConfiguration.test.ts package.json
git commit -m "feat: model admin technician service pricing"
```

## Task 5: Service-Specific Admin Editor

**Files:**

- Create: `src/components/admin/AdminTechnicianServiceConfiguration.tsx`
- Modify: `src/pages/admin/TechnicianDetails.tsx`

- [ ] **Step 1: Build the editor against the tested utilities**

The component accepts:

```ts
type Props = {
  servicesText: string;
  entries: AdminServicePricingEntry[];
  fallbackVehicleTypes: string[];
  editing: boolean;
  saving: boolean;
  onServicesTextChange: (value: string) => void;
  onEntriesChange: (entries: AdminServicePricingEntry[]) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};
```

Render known service cards from the catalog. Towing renders fleet-type pricing; flat-tire renders visit/distance fields, vehicle subcategory toggles, and tube/tubeless inputs; all other known and custom services render their configured standard fields. Disable mutations outside edit mode and while saving.

- [ ] **Step 2: Integrate nested state into `TechnicianDetails.tsx`**

Remove `EditableServiceCostRow`, generic row handlers, and generic pricing JSX. Hydrate nested entries from `mapped.service_costs`, derive fallback vehicles from `mapped.vehicle_types`, and synchronize entries whenever the comma-separated service text changes in edit mode.

- [ ] **Step 3: Save services and pricing together**

Submit:

```ts
const services = parseAdminServiceTokens(servicesText);
const service_costs = buildAdminServicePricingPayload(entries);
await apiFetch(`/api/admin/technician/${technicianId}/pricing`, {
  method: "PUT",
  admin: true,
  body: JSON.stringify({ services, service_costs }),
});
```

On success, refetch technician details. On cancel, restore the last fetched service text and nested entries. Before removing a service with saved pricing, require confirmation.

- [ ] **Step 4: Keep general profile save independent**

Remove `service_costs` from the general profile `handleSaveChanges` payload so that a business-information save cannot overwrite the service editor's nested document.

- [ ] **Step 5: Run frontend tests and build**

```powershell
npm test -- src/utils/adminTechnicianServiceConfiguration.test.ts
npm run build
npm run lint -- src/components/admin/AdminTechnicianServiceConfiguration.tsx src/pages/admin/TechnicianDetails.tsx src/utils/adminTechnicianServiceConfiguration.ts src/config/adminTechnicianServicePricingCatalog.ts
```

Expected: focused tests and build pass; changed files have no lint errors.

- [ ] **Step 6: Commit Task 5**

```powershell
git add src/components/admin/AdminTechnicianServiceConfiguration.tsx src/pages/admin/TechnicianDetails.tsx
git commit -m "feat: edit technician services and pricing in admin"
```

## Task 6: End-to-End Verification

**Files:**

- Verify all modified files in both repositories.

- [ ] **Step 1: Run complete backend verification**

```powershell
npm run test:technician-pricing
npm run test:towing-phase2
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run complete frontend verification**

```powershell
npm test -- --run
npm run build
npm run lint
```

Expected: tests and build exit 0. If repository-wide lint exposes unrelated pre-existing errors, record them and rerun lint on every changed source file to prove the feature files are clean.

- [ ] **Step 3: Inspect final diffs**

```powershell
git status --short
git diff --check HEAD~2..HEAD
```

Run in each repository. Confirm no registration-form file changed, no secrets were added, and only planned files are included.

- [ ] **Step 4: Manually validate the admin flow when local services are available**

Open `/admin/technician/930001`, confirm existing flat-tire values and vehicle categories appear, add a service, save, reload, and confirm persistence. Request flat-tire for a configured vehicle and confirm the technician card displays visit charge plus the lowest puncture price.

- [ ] **Step 5: Final requirement audit**

Confirm every success criterion in `docs/superpowers/specs/2026-06-18-technician-service-configuration-design.md` has either an automated assertion or a recorded manual check.
