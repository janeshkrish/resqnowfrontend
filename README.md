# ResQNow - Advanced Roadside Assistance Platform

ResQNow is a modern, real-time roadside assistance platform connecting vehicle owners with nearby technicians. Built with a mobile-first approach, it features live tracking, smart dispatching, and secure payments.

## 🚀 Key Features

- **Smart Dispatch System:** Automatically finds the nearest and best-rated technicians using Google Maps Distance Matrix.
- **Real-time Tracking:** Live GPS tracking of technicians and users with route visualization.
- **Secure Authentication:** Google OAuth and email-based login (JWT) for users and technicians.
- **Technician Dashboard:** Comprehensive tools for managing jobs, earnings, and availability.
- **Admin Console:** Manage technicians, users, and service categories.
- **Payment Integration:** Razorpay integration for seamless service payments.

## 🛠️ Technology Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express.js, Socket.io
- **Database:** TiDB (MySQL compatible)
- **Maps & Location:** Google Maps JavaScript API, Directions Service, Distance Matrix API
- **State Management:** React Context + Hooks,

## 📦 Project Structure

```
├── src/                  # Frontend (React)
│   ├── components/       # UI Components & Maps
│   ├── pages/            # App Pages (User/Tech/Admin)
│   ├── hooks/            # Custom Hooks (useGeolocation, etc.)
│   └── contexts/         # Auth & State Contexts
├── server/               # Backend (Node/Express)
│   ├── routes/           # API Routes
│   ├── services/         # Business Logic (Dispatch, Socket)
│   ├── config/           # Configuration
│   └── db.js             # Database Connection
└── public/               # Static Assets
```
.
## ⚡ Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL Database (or TiDB Cloud)
- Google Maps API Key (with Maps JS, Geocoding, Distance Matrix enabled).

### Installation

1.  **Clone the repository**

    ```bash.
    git clone <your-repo-url>
    cd resqnow
    ```

2.  **Install Dependencies**
    - **Root (Frontend):**
      ```bash
      npm install.
      ```
    - **Server (Backend):**
      ```bash
      cd server
      npm install
      cd ..
      ```

### Configuration

1.  **Frontend (`.env`)**
    Create a `.env` file in the root directory:

    ```env
    VITE_API_URL=http://localhost:3001
    VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
    VITE_RAZORPAY_KEY_ID=your_razorpay_key
    ```
.
2.  **Backend (`server/.env`)**
    Create a `.env` file in the `server` directory:

    ```env
    PORT=3001
    DB_HOST=your_tidb_host
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=resqnow_db
    DB_PORT=4000
    DB_SSL=true

    JWT_SECRET=your_jwt_secret
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

    FRONTEND_URL=http://localhost:8080
    VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key;
    ```

### Running the App

1.  **Start the Backend**

    ```bash
    cd server
    npm run dev
    ```

    _Server runs on `http://localhost:3001`_

2.  **Start the Frontend** (in a new terminal)
    ```bash
    npm run dev
    ```
    _App runs on `http://localhost:8080`_ 

## Netlify Deployment (Frontend)

Use these settings in Netlify:

```txt
Framework preset: Vite
Build command: npm run build
Build output directory: dist 
```

Set these environment variables in Vercel 

```txt
VITE_API_URL=https://your-render-backend.onrender.com
VITE_RAZORPAY_KEY_ID=your_live_or_test_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

You can copy the same keys from `.env.example` and set production values in Netlify UI o.

Frontend-only demo mode (no backend, optional)
```txt
VITE_FRONTEND_ONLY=true
```

When `VITE_FRONTEND_ONLY=true`, the app runs with in-browser mock API responses so UI flows work without a backend.
Do not set `VITE_FRONTEND_ONLY` for production backend-connected deployments ..

Notes:

- SPA routing is handled by `netlify.toml` redirects.
- `vercel.json` and `public/_redirects` are not needed for Netlify.
- Build output must remain `dist`.

## PWA Verification Guide

1. Deploy latest build to Netlify.
2. Open the deployed app in Chrome.
3. Open DevTools -> Application -> Manifest and verify:
   - `name` and `short_name` are visible
   - `display` is `standalone`
   - icons load (`icons/icon-192x192.png`, `icons/icon-512x512.png`)
4. Open DevTools -> Application -> Service Workers and verify:
   - service worker is active
   - scope is your site root
5. Run Lighthouse (Progressive Web App category) and verify installability + service worker checks pass.

## Offline Test Steps

1. Open the deployed app once with internet enabled.
2. In DevTools -> Application -> Service Workers, keep service worker active.
3. In DevTools -> Network, switch to `Offline`.
4. Reload `/` and one app route (for example `/services`) and verify app shell still loads.
5. Switch network back to online and confirm API-driven data refreshes.

## Payment Troubleshooting (Razorpay/UPI)

If payment stays in pending state:

1. Check Network tab for:
   - `POST /api/payments/confirm` (must be network, uncached)
   - `GET /api/service-requests/:id` polling every 3 seconds with `cache: no-store`
2. Confirm `VITE_API_URL` points to the correct backend in Netlify environment variables.
3. Confirm Razorpay SDK is loaded from `https://checkout.razorpay.com/v1/checkout.js` and not served from service worker cache.
4. In DevTools -> Application -> Service Workers, click `Update` (or `Unregister` once) if an old worker is still controlling the page.
5. Check backend logs for `/api/payments/confirm` signature verification and request status update to `paid` / `payment_status=completed`.

## 🗺️ Maps & Dispatch Logic

- **Google Maps Integration:** Replaced legacy Leaflet maps with native Google Maps JS API for better performance and accurate visualisations.
- **Dispatch Algorithm:**
  1.  Filters technicians by service type and vehicle compatibility.
  2.  Calculates precise driving distance/time using **Distance Matrix API**.
  3.  Scores candidates based on ETA and Rating.
  4.  Broadcasts offers to top 5 candidates via **Socket.io**.
- **Live Tracking:** Uses `socket.io` to stream technician location to the user's map in real-time.

## 🤝 Contributing

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
