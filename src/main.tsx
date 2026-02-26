import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SplashWrapper from './components/SplashWrapper.tsx'

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SplashWrapper>
            <App />
        </SplashWrapper>
    </StrictMode>
);
