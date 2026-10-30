import { defineConfig } from 'vite';import react from '@vitejs/plugin-react-swc';import path from 'node:path';
const boundary=path.resolve('e2e-integration/updates/boundaries.ts');
export default defineConfig({envDir:path.resolve('output/quality/updater-empty-env'),plugins:[react()],optimizeDeps:{entries:['e2e-integration/updates/index.html'],noDiscovery:true,include:['react','react-dom/client','react-router-dom','@capacitor/core','zod','@radix-ui/react-slot','class-variance-authority','clsx','tailwind-merge']},resolve:{alias:[
  ...['@/lib/appUpdates/native','@/lib/api','@/contexts/AuthContext','@/contexts/TechnicianAuthContext','@/contexts/TechnicianJobContext','@capacitor/app'].map(find=>({find,replacement:boundary})),{find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:5195,strictPort:true}});
