# Technician Service Configuration Design

**Date:** 2026-06-18

## Objective

Replace the generic pricing rows on `/admin/technician/:technicianId` with an editable service configuration that mirrors the pricing fields already used by technician registration. Entering a comma-separated service such as `flat-tire` must create that service's pricing editor, preserve the technician's submitted values, and let an administrator add services, vehicle categories, and prices.

Saved changes must update both the technician profile JSON and the normalized pricing table used to show service-specific technician estimates to users. The technician registration form itself is out of scope and will not be modified.

## Current-State Findings

- Technician registration already saves rich nested pricing in `technicians.service_costs`.
- `technician_services` stores normalized service-and-vehicle rows and is already consulted by pricing services.
- The admin technician page currently converts pricing into generic flat rows. That loses towing fleet data and flat-tire subcategory, tube, and tubeless prices.
- Fetching an admin technician replaces the rich profile pricing with flattened `technician_services` rows whenever normalized rows exist.
- Saving pricing writes both stores transactionally, but the generic admin payload cannot preserve all registration fields.
- `/api/technicians/nearby` currently reads profile JSON, selects the first matching service row, and can ignore the requested vehicle type. This can display the wrong technician price.

## Scope

### Included

- An admin pricing editor generated from the comma-separated service list.
- The same service-specific fields and vehicle categories shown in the supplied registration pricing PDF.
- Loading and editing existing nested registration pricing without losing fields.
- Adding and removing services and vehicle categories.
- Transactional synchronization of `technicians.specialties`, `technicians.service_type`, `technicians.service_costs`, and `technician_services`.
- Vehicle-aware technician pricing in nearby technician results.
- A flat-tire estimate calculated as visit charge plus puncture price.
- Automated backend and frontend tests for normalization, persistence payloads, synchronization, and estimate selection.

### Excluded

- Changes to the technician registration form or its submission behavior.
- A redesign of unrelated technician details sections.
- Changing platform, payment, or commission fee rules.
- Adding a new customer request step for choosing a flat-tire subcategory or tyre construction.
- Database columns for every service-specific field; variable fields remain in JSON metadata.

## Canonical Services and Pricing Fields

Service names are canonicalized with the application's existing aliases. Known service editors use these definitions:

| Service | Vehicle-specific fields |
| --- | --- |
| `towing` | Selected tow-truck types; per fleet type: base charge, free distance in km, cost per km |
| `flat-tire` | Visit charge, free distance in km, cost per km; selected vehicle subcategories; tube puncture and tubeless puncture price per subcategory |
| `battery` | Jumpstart/service charge, visit charge |
| `lockout` | Unlock/service charge, visit charge |
| `fuel` | Delivery charge |
| `mechanical` | Service charge, visit charge |
| `winching` | Recovery/service charge, visit charge |
| `ev-charging` | Charging support/service charge, visit charge |

Known vehicle categories are `bike`, `car`, `commercial`, and `ev`.

Towing fleet types are `flatbed`, `wheel-lift`, and `heavy-duty-wrecker`.

Flat-tire subcategories are:

- Bike: scooter, commuter bike, sports bike, premium bike.
- Car: hatchback, compact SUV, sedan, big SUV.
- Commercial: pickup/mini truck, tempo/van, light commercial, heavy truck.
- EV: electric scooter, electric bike, electric car, electric SUV.

An unknown service entered by an administrator remains supported through a generic editor with service charge and visit charge fields. This avoids discarding a valid custom service while keeping known services strongly structured.

## Admin Interaction

The Service Configuration card has one edit state and one save action.

1. On load, the page parses the technician's canonical `service_costs` and service list.
2. It renders only services saved for that technician. Each service initially renders only its saved vehicle categories. If a legacy service has no category information, the technician's enabled `vehicle_types` are used as a fallback.
3. While editing, changing the comma-separated list synchronizes service cards immediately:
   - A newly completed service token creates the matching editor.
   - Existing values are retained when service tokens are reordered or aliases are normalized.
   - A newly added known service starts with the technician's enabled vehicle categories, when available.
   - A service removed from the list is marked for removal and requires confirmation before save.
4. Each service card lets the administrator add or remove applicable vehicle categories and edit non-negative monetary or distance values.
5. Flat-tire and towing cards expose their nested subcategory or fleet controls instead of generic rows.
6. `Save Service Configuration` validates and submits the service list and pricing as one unit. `Cancel` restores the last server state.
7. General technician profile editing remains separate and continues to use its existing save action.

Saving errors leave the administrator's unsaved values in place and display the server validation message.

## Canonical Payload

The API continues to store registration-compatible nested entries in `technicians.service_costs`:

```json
[
  {
    "service_name": "flat-tire",
    "service_domain": "flat-tire",
    "vehicle_categories": ["bike"],
    "flat_tire_vehicle_pricing": {
      "bike": {
        "visit_charge": 120,
        "free_distance": 3,
        "extra_km_charge": 20,
        "selected_subcategories": ["scooter"],
        "subcategories": {
          "scooter": {
            "label": "Scooter",
            "tube_tyre_price": 120,
            "tubeless_price": 180
          }
        }
      }
    }
  }
]
```

The admin frontend will have pure conversion utilities for:

- Parsing and canonicalizing comma-separated service tokens.
- Hydrating editable state from nested or legacy pricing.
- Adding service templates without changing existing entries.
- Pruning blank values and building the registration-compatible save payload.
- Calculating a flat-tire starting estimate from a vehicle pricing object.

## Persistence and API Behavior

The existing `PUT /api/admin/technician/:id/pricing` endpoint will be extended, without breaking its current `service_costs`-only contract, to accept:

```json
{
  "services": ["flat-tire"],
  "service_costs": []
}
```

Within one database transaction, the endpoint will:

1. Lock or verify the technician row.
2. Canonicalize and deduplicate services.
3. Validate that every pricing entry belongs to a selected service and has unique service/vehicle combinations.
4. Normalize the nested payload into runtime rows.
5. Update `technicians.specialties` and `technicians.service_costs`.
6. Keep `technicians.service_type` when it remains selected; otherwise use the first selected service, or `other` when no services remain.
7. Replace that technician's `technician_services` rows.
8. Commit only after all updates succeed; otherwise roll back everything.

Each normalized `technician_services` row represents one service and vehicle category. Common amounts remain in dedicated columns. The complete vehicle-specific pricing object, including flat-tire subcategories and towing fleet pricing, remains in `metadata`.

For flat-tire normalized rows, `service_charge` is the lowest configured puncture price for that vehicle category. This provides a deterministic fallback while metadata retains every exact price.

The admin technician detail response will return the complete `technicians.service_costs` JSON as the primary editable representation. Flattened normalized rows are only used as a legacy fallback when profile JSON is empty or invalid; they will no longer overwrite valid nested pricing.

## User Estimate Resolution

`GET /api/technicians/nearby` will load normalized pricing rows in one bulk query for the candidate technician IDs and index them by technician, canonical service, and canonical vehicle category. It will not execute one query per technician.

For each technician card:

- Match the exact requested service and vehicle category first.
- Do not fall back to another vehicle category.
- For `flat-tire`, calculate `visit_charge + puncture_price`.
- Because the current customer request flow does not collect subcategory or tube/tubeless choice, `puncture_price` is the lowest configured puncture price in that vehicle category and the UI represents it as an estimate.
- If optional subcategory and tyre-type parameters become available later, the resolver can select the exact metadata price without a schema change.
- Free-distance and per-km fields are stored but are not included in this technician-card estimate, matching the approved visit-plus-puncture rule.
- For battery, lockout, mechanical, winching, and EV charging, the estimate is service charge plus visit charge.
- For fuel, the estimate is the delivery charge; fuel cost remains separate.
- Towing continues through the existing distance-aware towing estimator. Nearby cards may show its configured base price, but the route estimate remains authoritative.
- If the exact service/vehicle row has no usable price, return `price: null` instead of a generic or cross-vehicle fallback.

The response retains the existing `price` and `currency` properties for frontend compatibility and may include a pricing breakdown for clear labeling and future use.

## Validation and Error Handling

- Service and vehicle keys are canonicalized before comparison or persistence.
- Duplicate services, vehicle categories, fleet types, and subcategories are deduplicated.
- Monetary and distance values must be finite and non-negative; blank fields become `null`.
- Flat-tire categories require at least one selected subcategory with at least one tube or tubeless price before they can produce an estimate.
- Towing categories require at least one selected fleet type with usable base, free-distance, or per-km data.
- Invalid admin payloads return HTTP 400 with a field-relevant error.
- Missing technicians return HTTP 404.
- Database errors return HTTP 500 after rollback and do not leave profile JSON and normalized rows out of sync.

## Compatibility

- Existing technician registration payloads remain valid.
- Existing callers that send only `service_costs` to the admin pricing endpoint remain valid; their existing service list is retained.
- Legacy flat pricing arrays can still be loaded and edited through a generic compatibility conversion.
- No new database table or mandatory migration is required because `technician_services.metadata` already stores service-specific JSON.

## Testing Strategy

Backend tests will cover:

- Canonical nested pricing normalization for all known services.
- Flat-tire metadata preservation and minimum puncture selection.
- Exact service-and-vehicle matching without cross-vehicle fallback.
- Visit-plus-puncture estimate calculation.
- Transactional service list and pricing synchronization using a controlled database executor.
- Legacy `service_costs` compatibility.

Frontend tests will cover:

- Comma-separated service parsing and deduplication.
- Creating a flat-tire editor when `flat-tire` is entered.
- Preserving existing nested registration values.
- Adding a service without modifying other service entries.
- Building the canonical nested payload.
- Flat-tire estimate helper behavior for tube, tubeless, and missing prices.

Verification will include focused tests, backend build checks, frontend type/build checks, linting of changed files, and a rendered admin-page check at desktop and mobile widths when the local environment can run the application.

## Success Criteria

- Technician 930001 initially shows only the services and detailed vehicle pricing already stored for that technician.
- Entering `flat-tire` creates a flat-tire pricing card with the PDF-defined fields.
- An administrator can add services and prices and save them from the same Service Configuration card.
- Reloading the page preserves every nested field.
- `technicians.service_costs` and `technician_services` represent the same saved configuration after every successful update.
- A customer requesting flat-tire for a selected vehicle sees that technician's visit charge plus applicable puncture price as the estimate.
- A technician's price is never taken from a different service or vehicle category.
