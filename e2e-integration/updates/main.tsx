import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AppUpdateProvider } from '../../src/components/AppUpdateProvider';
import { AppUpdatePanel } from '../../src/components/AppUpdatePanel';
import { role } from './boundaries';
history.replaceState(null,'',role==='technician'?'/technician/profile':'/settings');
function Harness(){const navigate=useNavigate();return <><h1>Test-only native bridge simulation</h1><p>Real UI and release API. This is not Android installation acceptance.</p><AppUpdatePanel />
  <button onClick={()=>{Object.assign(window.__updateTest.state,{phase:'ready',bytesDownloaded:16});window.__updateTest.emit();}}>Simulate verified download</button>
  <button onClick={()=>{window.__updateTest.state.phase='ready';window.__updateTest.emit();}}>Simulate permission return</button>
  <button onClick={()=>navigate('/payment/test')}>Enter payment flow</button></>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter future={{v7_startTransition:true}}><AppUpdateProvider><Harness /></AppUpdateProvider></BrowserRouter>);
