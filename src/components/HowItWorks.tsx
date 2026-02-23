
import { MapPin, Phone, UserCheck, Truck } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    id: 1,
    title: "Request Service",
    description: "Select your required service and provide your vehicle details",
    icon: Phone,
    color: "bg-red-500",
    hoverColor: "hover:bg-red-600",
  },
  {
    id: 2,
    title: "Share Location",
    description: "Allow us to access your current location or enter it manually",
    icon: MapPin,
    color: "bg-blue-500",
    hoverColor: "hover:bg-blue-600",
  },
  {
    id: 3,
    title: "Technician Assignment",
    description: "We'll assign the nearest qualified technician to assist you",
    icon: UserCheck,
    color: "bg-green-500",
    hoverColor: "hover:bg-green-600",
  },
  {
    id: 4,
    title: "Track & Assistance",
    description: "Track your technician in real-time until they arrive to help",
    icon: Truck,
    color: "bg-yellow-500",
    hoverColor: "hover:bg-yellow-600",
  },
];

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-r from-gray-50 to-white">
      <div className="container px-4">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700">
            How It Works
          </span>
        </h2>
        <p className="text-base md:text-lg text-center text-gray-600 max-w-3xl mx-auto mb-8 md:mb-12 px-4">
          Getting help is quick and easy with our simple 4-step process
        </p>

        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-0 right-0 top-20 h-1 bg-gray-200 hidden xl:block">
            <div className="h-full bg-gradient-to-r from-primary to-blue-600" style={{ width: `${activeStep ? (activeStep / steps.length) * 100 : 25}%` }}></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className="flex flex-col items-center text-center relative service-card px-4"
                onMouseEnter={() => setActiveStep(step.id)}
                onMouseLeave={() => setActiveStep(null)}
              >
                <div className="relative z-10 mb-6 md:mb-8 transition-transform duration-300 transform hover:scale-110">
                  <div className={`${step.color} text-white rounded-full p-5 md:p-6 shadow-lg`}>
                    <step.icon className="h-8 w-8 md:h-10 md:w-10" />
                  </div>
                </div>
                
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold mb-4 shadow-md transition-transform duration-300 ${activeStep === step.id ? 'scale-110' : ''} ${step.color}`}>
                  {step.id}
                </div>
                
                <div className={`rounded-2xl bg-white p-6 md:p-8 border border-gray-100 shadow-sm w-full ${activeStep === step.id ? 'transform -translate-y-2 shadow-md' : ''} transition-all duration-300`}>
                  <h3 className="text-lg md:text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
