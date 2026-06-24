# ResQNow Frontend

ResQNow is a production-oriented roadside assistance web and mobile frontend for customers, technicians, and administrators. The app connects stranded vehicle owners with nearby service providers, supports live job tracking, and integrates technician onboarding, pricing, payments, notifications, marketplace flows, and admin operations.

This repository contains the React/Vite frontend, PWA assets, Capacitor Android app shell, public assets, frontend service clients, and UI workflows for the ResQNow platform. The API server lives in the separate `resqnowbackend` repository.

## Proprietary Notice

This project is proprietary and confidential. Unauthorized copying, modification, redistribution, commercial usage, reproduction, or publication of this repository or any part of its codebase is strictly prohibited.

Forking, downloading, cloning, redistributing, sublicensing, reselling, or reusing any part of the codebase without explicit written permission from the owner is not allowed. The code is provided only for authorized review and demonstration purposes. Any unauthorized access, use, distribution, or reproduction may result in legal action.

## Features

- Customer roadside assistance booking for car, bike, commercial, and EV service flows.
- Service categories for towing, flat tyre, battery, fuel, lockout, mechanical support, and related emergency workflows.
- Authentication flows for customer login, registration, OTP verification, Google OAuth callback handling, and session persistence.
- Technician portal for registration, onboarding, verification, live jobs, availability, location updates, earnings, reviews, dues, fleet vehicles, and team members.
- Admin console for dashboards, technician approvals, technician service configuration, users, analytics, payments, payouts, email templates, command center, complaints, and notifications.
- Real-time updates through Socket.IO with polling fallback for critical job states.
- Payment flows using Razorpay for service requests, subscriptions, registration, and technician dues.
- Google Maps and OpenStreetMap-backed location workflows through backend API endpoints.
- Firebase Cloud Messaging support for web and Android push notifications.
- PWA support with app manifest, service worker caching, offline app shell behavior, install prompt, and icon assets.
- Frontend-only demo mode for UI review without a live backend.
- Capacitor Android project for native app packaging.

## Tech Stack

- React 18 with TypeScript
- Vite 5
- React Router
- Tailwind CSS
- shadcn/ui and Radix UI primitives
- TanStack React Query
- Socket.IO client
- Firebase Web SDK and Firebase Cloud Messaging
- Razorpay Checkout
- Google Maps JavaScript API and Google Geocoding
- Leaflet and React Leaflet for selected map experiences
- Capacitor Android
- Vitest and Testing Library
- Netlify/Vercel-compatible SPA deployment

## Folder Structure

```text
resqnowfrontend/
  android/                 # Capacitor Android shell and native notification code
  assets/                  # Source static assets used during development
  docs/                    # Design notes and implementation plans
  icons/                   # Source icon assets
  public/                  # Public web assets, PWA icons, manifest, redirects, brand images
  src/
    assets/                # Imported frontend image assets
    components/            # Shared UI, layout, service request, map, admin, technician components
    config/                # Frontend service catalog and pricing configuration
    contexts/              # Auth, admin auth, technician auth, socket, and job contexts
    data/                  # Static data catalogs
    hooks/                 # Reusable React hooks for jobs, payments, geolocation, FCM, pricing
    lib/                   # API client, Firebase, navigation, geolocation, Google Places helpers
    mocks/                 # Frontend-only/demo data
    pages/                 # Customer, technician, admin, and admin-extended routes
    services/              # Frontend service wrappers for API domains
    test/                  # Vitest setup
    types/                 # Shared TypeScript declarations
    utils/                 # Mapping, pricing, upload, technician, and service helpers
  capacitor.config.ts      # Capacitor app configuration
  vite.config.ts           # Vite, PWA, dev server, and build configuration
  netlify.toml             # Netlify build and SPA redirect configuration
  vercel.json              # Vercel SPA rewrite configuration
```

## Prerequisites

- Node.js 18 or newer.
- npm 9 or newer.
- Access to the ResQNow backend API.
- Google Maps API key with the required browser restrictions and APIs enabled.
- Razorpay key ID for checkout.
- Firebase web project configuration and VAPID key if push notifications are enabled.
- Android Studio and Java/Gradle toolchain for Android packaging.

## Installation

```bash
git clone https://github.com/janeshkrish/resqnowfrontend.git
cd resqnowfrontend
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update `.env` with local or staging values before running the app.

## Environment Variables

All frontend environment variables must be prefixed with `VITE_` because they are bundled into client-side code.

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Yes for backend-connected builds | Backend API origin, for example `http://localhost:5000` or `https://resqnowbackend.onrender.com`. Do not append `/api`. |
| `VITE_FRONTEND_ONLY` | Optional | Set to `true` only for demo mode without a backend. Do not enable for production backend-connected deployments. |
| `VITE_GOOGLE_MAPS_API_KEY` | Required for Google map/geocoding UI | Public browser key restricted by domain and API. |
| `VITE_RAZORPAY_KEY_ID` | Required for payment UI | Razorpay public key ID. The secret key must stay only in the backend. |
| `VITE_PAYMENTS_DISABLED` | Optional | Feature flag for disabling payment flows in local/demo environments. |
| `VITE_FIREBASE_API_KEY` | Required for FCM | Firebase public client API key. Restrict it in Google Cloud/Firebase. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Required for FCM | Firebase auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | Required for FCM | Firebase project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Required for FCM | Firebase storage bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Required for FCM | Firebase messaging sender ID. |
| `VITE_FIREBASE_APP_ID` | Required for FCM | Firebase app ID. |
| `VITE_FIREBASE_VAPID_KEY` | Required for web push | Public web push VAPID key. |

Never place backend secrets, database credentials, JWT secrets, Razorpay secrets, SMTP credentials, or Firebase Admin private keys in this repository.

## API Configuration

The frontend API client is centralized in `src/lib/api.ts`.

- API calls use `VITE_API_URL` as the base origin.
- Socket.IO clients use the same backend origin with the `/socket.io` path.
- Production builds fail when `VITE_API_URL` is missing unless `VITE_FRONTEND_ONLY=true`.
- A historical fallback points to `https://resqnowbackend.onrender.com`, but production deployments should always set `VITE_API_URL` explicitly.
- The app calls backend routes under `/api`, including auth, users, technicians, service requests, payments, vehicles, notifications, pricing, public location utilities, admin, and admin-extended endpoints.

For local full-stack development, run the backend first and set:

```env
VITE_API_URL=http://localhost:5000
```

If the backend is configured to use another port, match that value here.

## Running Locally

Start the frontend dev server:

```bash
npm run dev
```

The Vite dev server runs on:

```text
http://localhost:8080
```

Run a mobile-oriented dev session:

```bash
npm run dev:mobile
```

Run a production preview after building:

```bash
npm run build
npm run preview
```

## Frontend-Only Demo Mode

For UI demos without a backend:

```env
VITE_FRONTEND_ONLY=true
VITE_API_URL=
```

In this mode, `src/lib/api.ts` installs mock API responses in the browser so customer, technician, admin, pricing, payment, location, and tracking workflows can be reviewed without a live API.

Do not set `VITE_FRONTEND_ONLY=true` for production.

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite development server. |
| `npm run dev:mobile` | Start mobile-oriented development helper. |
| `npm run build` | Create production build in `dist/`. |
| `npm run build:dev` | Build with Vite development mode. |
| `npm run preview` | Preview the built app locally. |
| `npm test` | Run Vitest tests. |
| `npm run lint` | Run ESLint. |
| `npm run repair:brand-logos` | Repair brand logo assets. |
| `npm run migrate:technicians:domains:dry` | Dry-run technician service domain normalization helper. |
| `npm run migrate:technicians:domains:apply` | Apply technician service domain normalization helper. |
| `npm run migrate:requests:amounts:dry` | Dry-run service request amount backfill helper. |
| `npm run migrate:requests:amounts:apply` | Apply service request amount backfill helper. |
| `npm run audit:dispatch:matrix` | Run dispatch matrix audit helper. |
| `npm run audit:dispatch:matrix:full` | Run dispatch matrix audit including passing cases. |
| `npm run audit:dispatch:matrix:simulate` | Simulate ready-state dispatch matrix audit. |

Some migration and audit scripts depend on backend/server-side code paths and environment configuration. Use them only in authorized environments.

## Build and Deployment

### Standard Build

```bash
npm run build
```

Build output is written to:

```text
dist/
```

### Netlify

Use these settings:

```text
Framework preset: Vite
Build command: npm run build
Publish directory: dist
```

Required Netlify environment variables:

```text
VITE_API_URL=https://your-backend.example.com
VITE_GOOGLE_MAPS_API_KEY=your-public-google-maps-key
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
VITE_FIREBASE_API_KEY=your-firebase-public-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:replace-me
VITE_FIREBASE_VAPID_KEY=your-public-web-push-vapid-key
```

SPA routing is handled by `netlify.toml` and `public/_redirects`.

### Vercel

The repository includes `vercel.json` with an SPA rewrite to `index.html`. Set the same `VITE_*` variables in the Vercel project settings.

### PWA Verification

After deployment:

1. Open the deployed app in Chrome.
2. Open DevTools > Application > Manifest and verify `name`, `short_name`, `display`, and icon loading.
3. Open DevTools > Application > Service Workers and verify the service worker is active with root scope.
4. Run Lighthouse with the Progressive Web App category.
5. Confirm the Razorpay checkout script is not served from stale service worker cache.

### Offline Test Steps

1. Open the deployed app once while online.
2. Keep the service worker active in DevTools.
3. Switch DevTools > Network to Offline.
4. Reload `/` and another app route such as `/services`.
5. Confirm the app shell loads.
6. Return online and confirm API-driven data refreshes.

### Payment Troubleshooting

If Razorpay or UPI payment confirmation remains pending:

1. Confirm `VITE_API_URL` points to the active backend.
2. Inspect the Network tab for `POST /api/payments/confirm`.
3. Confirm service request polling calls use the correct backend and are not served from cache.
4. Confirm Razorpay SDK loads from `https://checkout.razorpay.com/v1/checkout.js`.
5. Update or unregister old service workers during deployment troubleshooting.
6. Check backend logs for signature verification and payment status updates.

## Android / Capacitor

The Capacitor app uses:

```text
appId: com.resqnow1.app
appName: ResQNow
webDir: dist
```

Typical Android build flow:

```bash
npm run build
npx cap sync android
npx cap open android
```

Review `capacitor.config.ts`, `android/app/google-services.json`, signing configuration, notification permissions, and backend navigation allowlist before release.

## Screenshots

Add production screenshots before publishing the repository publicly or sharing with stakeholders.

| Area | Screenshot |
| --- | --- |
| Customer home and service booking | `docs/screenshots/customer-home.png` |
| Live request tracking | `docs/screenshots/request-tracking.png` |
| Technician dashboard | `docs/screenshots/technician-dashboard.png` |
| Admin dashboard | `docs/screenshots/admin-dashboard.png` |
| Payment flow | `docs/screenshots/payment-flow.png` |

## Quality Checks

Recommended before every pull request:

```bash
npm run build
npm test
npm run lint
npm audit
```

Current validation status from the latest local review:

- `npm run build`: passes, with a large chunk warning.
- `npm test`: passes existing Vitest suite.
- `npm run lint`: currently fails and needs cleanup.
- `npm audit`: currently reports vulnerable transitive and direct dependencies that should be triaged before production release.

## Repository Security Recommendations

- Keep this repository private for maximum protection.
- Disable forking if GitHub plan and repository settings allow it.
- Restrict collaborator permissions to least privilege.
- Protect the `main` or `master` branch.
- Require pull requests and CODEOWNERS review for protected branches.
- Require signed commits.
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection.
- Keep `.env` files untracked.
- Rotate any key that was ever committed, shared, or packaged into a public artifact.
- Store production secrets only in deployment platform secret managers.
- Keep `CODEOWNERS`, `SECURITY.md`, `CONTRIBUTING.md`, and `LICENSE.md` current.

## Contributing

This is a private proprietary project. Contributions are accepted only from authorized collaborators.

1. Create a feature branch from the protected base branch.
2. Keep changes scoped to one feature or fix.
3. Update documentation when routes, environment variables, workflows, or deployment steps change.
4. Run the quality checks listed above.
5. Open a pull request with a clear summary, screenshots for UI changes, and validation notes.
6. Do not commit secrets, `.env` files, generated build output, debug logs, APK artifacts, or private customer data.

See `CONTRIBUTING.md` for detailed internal contribution rules.

## License

This repository is not open source. All rights are reserved by the owner.

See `LICENSE.md` for the proprietary license terms.

## Author

ResQNow

Owner/Maintainer: Janesh Krish

GitHub: `@janeshkrish`

Project: ResQNow roadside assistance platform
