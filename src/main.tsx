import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SplashWrapper from './components/SplashWrapper.tsx'

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SplashWrapper>
            <App />
        </SplashWrapper>
    </StrictMode>
);
