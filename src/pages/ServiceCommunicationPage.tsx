import { useParams, useNavigate } from "react-router-dom";
import ServiceCommunication from "@/components/ServiceCommunication";

const ServiceCommunicationPage = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/');
  };

  // Map service IDs to readable names
  const serviceNames: Record<string, string> = {
    'battery-jumpstart': 'Battery Jumpstart',
    'flat-tyre': 'Flat Tyre Assistance',
    'fuel-delivery': 'Emergency Fuel Delivery',
    'lockout-assistance': 'Vehicle Lockout Assistance',
    'towing': 'Vehicle Towing Service',
    'engine-diagnostic': 'Engine Diagnostic',
    'brake-service': 'Brake Service',
    'ac-repair': 'AC Repair',
    'oil-change': 'Oil Change Service',
    'general-maintenance': 'General Maintenance',
    'ev-charging': 'EV Charging Assistance'
  };

  const serviceType = serviceNames[serviceId || ''] || 'Service Request';

  return (
    <ServiceCommunication
      serviceType={serviceType}
      vehicleInfo={undefined}
      location={undefined}
      onClose={handleClose}
    />
  );
};

export default ServiceCommunicationPage;