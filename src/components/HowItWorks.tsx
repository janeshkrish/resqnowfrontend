
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
    <section>
      <div className="container px-4">
        <div className="text-center md:text-left mb-16 max-w-2xl">
           <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight mb-4 leading-tight">
             How <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-600">ResQNow</span> Works
           </h2>
           <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium">
             Four simple steps to get you back on the road safely and quickly.
           </p>
        </div>

        <div className="relative">
          {/* Subtle Progress Track (Desktop) */}
          <div className="absolute left-[50%] md:left-0 md:right-0 top-0 bottom-0 w-0.5 md:w-auto md:h-0.5 md:top-24 bg-slate-200 dark:bg-slate-800 hidden md:block">
            <div 
               className="w-full h-full bg-gradient-to-r md:bg-gradient-to-b from-primary to-blue-600 transition-all duration-700 ease-out" 
               style={{ width: activeStep ? `${(activeStep / steps.length) * 100}%` : '0%' }}
            ></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 relative z-10">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className="group relative flex flex-col items-center md:items-start text-center md:text-left pt-0 md:pt-16"
                onMouseEnter={() => setActiveStep(step.id)}
                onMouseLeave={() => setActiveStep(null)}
              >
                {/* Step Node */}
                <div className="relative mb-6 md:absolute md:top-6 md:-translate-y-1/2 flex items-center justify-center">
                   {/* Glow effect */}
                   <div className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300 ${step.color}`}></div>
                   
                   <div className={`w-16 h-16 rounded-2xl md:rounded-[1.5rem] bg-white dark:bg-slate-900 border-2 ${activeStep && activeStep >= step.id ? 'border-primary' : 'border-slate-200 dark:border-slate-800'} flex items-center justify-center relative z-10 transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                     <step.icon className={`h-7 w-7 ${activeStep && activeStep >= step.id ? 'text-primary' : 'text-slate-400 dark:text-slate-500'} transition-colors duration-300`} />
                   </div>
                   
                   {/* Step Number Badge */}
                   <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-white dark:border-slate-900">
                      {step.id}
                   </div>
                </div>
                
                {/* Content Card */}
                <div className={`w-full bg-white dark:bg-card rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 ${activeStep === step.id ? 'md:-translate-y-2 border-primary/20' : ''}`}>
                  <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">{step.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed font-medium">{step.description}</p>
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
