import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SplashWrapper from './components/SplashWrapper.tsx'
import { captureRecoveryLink } from './lib/passwordRecoveryLink'

captureRecoveryLink();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SplashWrapper>
            <App />
        </SplashWrapper>
    </StrictMode>
);
