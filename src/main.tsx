import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SplashWrapper from './components/SplashWrapper.tsx'
import { captureRecoveryLink } from './lib/passwordRecoveryLink'
import { startAppUpdateReload } from './lib/appUpdateReload'

captureRecoveryLink();

// Website only: the Android app ships without the PWA service worker, and dev has none.
if (import.meta.env.PROD && import.meta.env.VITE_NATIVE_BUILD !== 'true') {
    startAppUpdateReload();
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SplashWrapper>
            <App />
        </SplashWrapper>
    </StrictMode>
);
