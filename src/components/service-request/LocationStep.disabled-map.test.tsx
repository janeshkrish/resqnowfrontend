import {useEffect} from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import LocationStep from './LocationStep';
import {useUnifiedServiceRequestFlow} from '@/hooks/useUnifiedServiceRequestFlow';

const api=vi.hoisted(()=>vi.fn());
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'android'},registerPlugin:()=>({})}));
vi.mock('@/lib/api',()=>({apiFetch:api,readJsonSafely:async(response:Response)=>response.json()}));
vi.mock('@/hooks/useGeolocation',()=>({useGeolocation:()=>({coordinates:null,address:null,loading:false,error:null,requestLocation:vi.fn()})}));
vi.mock('@/lib/googlePlaces',()=>({geocodeAddressWithGoogle:vi.fn(),reverseGeocodeWithGoogle:vi.fn()}));
afterEach(()=>{vi.unstubAllEnvs();localStorage.clear();});

function Booking(){
  const flow=useUnifiedServiceRequestFlow({serviceId:'towing',vehicleType:'car',storageKey:'disabled-map-booking',navigate:vi.fn(),validateStep1:()=>true,buildVehicleModel:d=>d.vehicleModel,
    createInitialFormData:()=>({name:'Asha',phone:'9999999999',vehicleType:'car',vehicleSubtype:'sedan',vehicleModel:'Swift',location:'Pickup',locationLat:11,locationLng:77,locationCoordinates:{lat:11,lng:77},dropLocation:'',details:'',selectedTechnicianId:null})});
  useEffect(()=>{flow.setCurrentStep(2);},[]);
  if(flow.currentStep===3)return <p>Details step</p>;
  return <><LocationStep formData={flow.formData} onInputChange={flow.handleInputChange} isGettingLocation={false} onGetCurrentLocation={flow.handleGetCurrentLocation}
    onLocationSelect={flow.handleLocationSelect} onDropLocationSelect={flow.handleDropLocationSelect} requiresDropLocation towingEstimate={flow.towingEstimate} isEstimatingTowing={flow.isEstimatingTowing}/>
    <button disabled={!flow.canProceed()} onClick={()=>void flow.handleNext()}>Continue</button></>;
}

it('lets a new map-disabled Android towing user select a typed destination and Continue only after the real coordinate/quote gate',async()=>{
  vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED','false');localStorage.clear();
  api.mockImplementation(async(path:string)=>new Response(JSON.stringify(path.includes('location-search')?{results:[{id:'osm-workshop',label:'Garage, Coimbatore',address:'Garage, Coimbatore',lat:11.04,lng:76.99,provider:'photon'}]}:{distanceKm:8,polyline:[],quote:{distance_km:8,estimated_duration:15}}),{status:200}));
  render(<Booking/>);
  expect(screen.getByText('Maps are temporarily disabled in this Android release.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Continue'})).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox',{name:'Take it to'}),{target:{value:'Garage'}});
  fireEvent.click(await screen.findByRole('option',{name:/Garage, Coimbatore/i}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Continue'})).toBeEnabled(),{timeout:4000});
  expect(api.mock.calls.some(([path])=>String(path).includes('provider=photon'))).toBe(true);
  const estimate=api.mock.calls.find(([path,init])=>init?.body&&String(path).includes('towing'));
  expect(estimate).toBeTruthy();expect(JSON.parse(estimate![1].body)).toMatchObject({dropLat:11.04,dropLng:76.99});
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect(await screen.findByText('Details step')).toBeInTheDocument();
});
