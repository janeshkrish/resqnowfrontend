import { useState } from 'react';
import { Check, ChevronDown, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VehicleArt } from '@/components/request-form/art';
import { canonicalizeServiceKey, canonicalizeVehicleKey } from '@/config/technicianNormalization';
import { SIGNUP_SERVICES, SIGNUP_SUBTYPES, SIGNUP_VEHICLES, type SignupVehicle } from '@/utils/technicianSignupPricing';

export interface PricingRow {
  service_id: number;
  vehicle_category_id: number;
  vehicle_subcategory_id?: number | null;
  pricing_json: Record<string, string | number>;
}
export interface PricingTemplate {
  services: { id: number; service_name: string; service_slug?: string }[];
  categories: { id: number; category_name: string }[];
  subcategories: { id: number; vehicle_category_id: number; subcategory_name: string }[];
  pricingFields: { id: number; service_id: number; field_key: string; field_label: string; field_type?: string; required?: boolean }[];
}
interface Props extends PricingTemplate {
  selectedServiceIds: string[];
  selectedVehicleTypes: string[];
  value: PricingRow[];
  onChange: (data: PricingRow[]) => void;
}
export default function DynamicPricingStep({ services, categories, subcategories, pricingFields, selectedServiceIds, selectedVehicleTypes, value, onChange }: Props) {
  const [openService, setOpenService] = useState(selectedServiceIds[0]);
  const [activeVehicles, setActiveVehicles] = useState<Record<string, string>>({});
  const [activeSubtypes, setActiveSubtypes] = useState<Record<string, string>>({});
  return <div className="rq-pricing-services">
    {selectedServiceIds.map(serviceId => {
      const visual = SIGNUP_SERVICES.find(item => item.id === serviceId);
      const service = services.find(item => canonicalizeServiceKey(item.service_slug || item.service_name) === serviceId);
      const fields = pricingFields.filter(field => String(field.service_id) === String(service?.id));
      const vehicleId = activeVehicles[serviceId];
      const vehicle = categories.find(item => canonicalizeVehicleKey(item.category_name) === vehicleId);
      const key = `${serviceId}:${vehicleId}`;
      const savedRows = value.filter(row => row.service_id === service?.id && row.vehicle_category_id === vehicle?.id);
      const subtypeId = activeSubtypes[key] || String(savedRows[0]?.pricing_json.vehicle_subtype || '');
      const subtype = vehicleId ? SIGNUP_SUBTYPES[vehicleId as SignupVehicle]?.find(item => item.id === subtypeId) : undefined;
      const row = savedRows.find(item => item.pricing_json.vehicle_subtype === subtypeId);
      const isOpen = openService === serviceId;
      const updateRow = (nextSubtype: { id: string; label: string }, fieldKey?: string, fieldValue?: string) => {
        if (!service || !vehicle) return;
        const previous = value.find(item => item.service_id === service.id && item.vehicle_category_id === vehicle.id && item.pricing_json.vehicle_subtype === nextSubtype.id);
        // Unseeded subtype names are preserved in the existing JSON column.
        const masterSubtype = subcategories.find(item => String(item.vehicle_category_id) === String(vehicle.id)
          && item.subcategory_name.toLowerCase().replace(/^ev |^electric /, '') === nextSubtype.label.toLowerCase());
        const updated: PricingRow = {
          service_id: service.id, vehicle_category_id: vehicle.id,
          vehicle_subcategory_id: masterSubtype?.id || null,
          pricing_json: { ...previous?.pricing_json, service_domain: serviceId, vehicle_type: vehicleId,
            vehicle_subtype: nextSubtype.id, vehicle_subtype_label: nextSubtype.label,
            ...(fieldKey ? { [fieldKey]: fieldValue === '' ? '' : Number(fieldValue) } : {}) },
        };
        onChange(previous ? value.map(item => item === previous ? updated : item) : [...value, updated]);
      };
      return <section className="rq-signup-card rq-pricing-service" key={serviceId}>
        <button type="button" className="rq-pricing-service-heading" aria-expanded={isOpen} onClick={() => setOpenService(isOpen ? '' : serviceId)}>
          <img src={`/images/home/services/${serviceId}.webp`} alt="" />
          <span><strong>{visual?.label || serviceId}</strong><small>{selectedVehicleTypes.length} vehicle {selectedVehicleTypes.length === 1 ? 'type' : 'types'} selected</small></span>
          <ChevronDown className={isOpen ? 'is-open' : ''} size={18} />
        </button>
        {isOpen && <div className="rq-pricing-service-body">
          {!service || !fields.length ? <p role="alert" className="rq-signup-error">Pricing is unavailable for this service. Please retry loading the prices.</p> : <>
            <p className="rq-signup-label">01 <span>Choose a vehicle</span></p>
            <div className="rq-pricing-vehicles">
              {SIGNUP_VEHICLES.filter(item => selectedVehicleTypes.includes(item.id)).map(item => <button type="button" key={item.id}
                aria-pressed={vehicleId === item.id} aria-label={item.label} className={`rq-choice rq-pricing-vehicle ${vehicleId === item.id ? 'is-selected' : ''}`}
                onClick={() => setActiveVehicles(prev => ({ ...prev, [serviceId]: item.id }))}>
                <img src={item.image} alt="" /><span>{item.label}</span>
              </button>)}
            </div>
            {vehicleId && <div className="rq-pricing-subtypes">
              <p className="rq-signup-label">02 <span>Which {vehicleId === 'commercial' ? 'commercial vehicle' : vehicleId === 'ev' ? 'electric vehicle' : vehicleId} type?</span></p>
              <div className="rq-subtype-grid">{SIGNUP_SUBTYPES[vehicleId as SignupVehicle].map(item => <button type="button" key={item.id} aria-label={item.label} aria-pressed={subtypeId === item.id}
                className={`rq-subtype ${subtypeId === item.id ? 'is-selected' : ''}`} onClick={() => { setActiveSubtypes(prev => ({ ...prev, [key]: item.id })); updateRow(item); }}>
                {item.art && <span className="rq-subtype-art"><VehicleArt art={item.art} electric={vehicleId === 'ev'} width={36} height={18} /></span>}
                <span>{item.label}</span>{item.detail && <small>{item.detail}</small>}
                {savedRows.some(saved => saved.pricing_json.vehicle_subtype === item.id && fields.some(field => typeof saved.pricing_json[field.field_key] === 'number')) && <Check size={12} aria-label="Has saved prices" />}
              </button>)}</div>
            </div>}
            {subtype && <div className="rq-pricing-fields">
              <div className="rq-pricing-context"><span>03 · Set your rates</span><strong>{visual?.label} <ArrowRight size={12} /> {vehicleId === 'ev' ? 'EV · ' : ''}{subtype.label}</strong></div>
              <div className="rq-signup-grid">{fields.map(field => {
                const id = `price-${service.id}-${vehicle?.id}-${subtype.id}-${field.id}`;
                const isDistance = /distance|free_km/i.test(field.field_key);
                return <div className="rq-field" key={field.id}><Label htmlFor={id}>{field.field_label}{field.required ? ' *' : ''}</Label>
                  <div className="rq-price-input"><span>{isDistance ? 'km' : '₹'}</span><Input id={id} type="number" inputMode="decimal" min="0" step={isDistance ? '0.1' : '0.01'}
                    placeholder="0" value={row?.pricing_json[field.field_key] ?? ''} onChange={event => updateRow(subtype, field.field_key, event.target.value)} /></div>
                </div>;
              })}</div>
              <p className="rq-signup-hint">Select another subtype to set its rates. Your entered prices stay saved in this form.</p>
            </div>}
          </>}
        </div>}
      </section>;
    })}
  </div>;
}
