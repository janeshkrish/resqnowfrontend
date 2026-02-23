import { Check, Clock, MapPin, Car, User, Wrench, CreditCard, AlertCircle } from "lucide-react";

type StepData = {
  name: string;
  icon: React.ElementType;
  completed: boolean;
  active: boolean;
  color: string;
};

interface LiveProgressTrackerProps {
  currentStep: number;
  totalSteps: number;
}

const LiveProgressTracker = ({ currentStep, totalSteps }: LiveProgressTrackerProps) => {
  const steps: StepData[] = [
    { name: "Personal", icon: User, completed: currentStep > 1, active: currentStep === 1, color: "red" },
    { name: "Vehicle", icon: Car, completed: currentStep > 2, active: currentStep === 2, color: "yellow" },
    { name: "Location", icon: MapPin, completed: currentStep > 3, active: currentStep === 3, color: "blue" },
    { name: "Technician", icon: Wrench, completed: currentStep > 4, active: currentStep === 4, color: "purple" },
    { name: "Payment", icon: CreditCard, completed: currentStep > 5, active: currentStep === 5, color: "orange" },
    { name: "Confirm", icon: Check, completed: currentStep > 6, active: currentStep === 6, color: "green" }
  ];

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="bg-gradient-to-r from-red-50 via-white to-blue-50 rounded-2xl p-6 mb-8 border border-red-200/50 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500 rounded-full">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Service Request Progress</h3>
            <p className="text-sm text-gray-600">Track your request status in real-time</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-600">Step {currentStep} of {totalSteps}</div>
          <div className="text-xs text-gray-500">{Math.round(progressPercentage)}% Complete</div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="relative h-3 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 via-blue-500 to-green-500 transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progressPercentage}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full" />
      </div>
      
      {/* Steps */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.name} className="flex flex-col items-center relative">
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                    step.completed
                      ? "bg-green-500 border-green-300 shadow-lg transform scale-110"
                      : step.active
                      ? "bg-red-500 border-red-300 shadow-lg transform scale-110 animate-pulse"
                      : "bg-gray-100 border-gray-200"
                  }`}
                >
                  {step.completed ? (
                    <Check className="h-6 w-6 text-white" />
                  ) : (
                    <Icon
                      className={`h-5 w-5 ${
                        step.active ? "text-white" : "text-gray-400"
                      }`}
                    />
                  )}
                </div>
                
                {/* Active step indicator */}
                {step.active && (
                  <div className="absolute -inset-1 bg-red-200 rounded-full animate-ping opacity-75" />
                )}
              </div>
              
              <div className="mt-2 text-center">
                <span
                  className={`text-xs font-semibold block ${
                    step.completed
                      ? "text-green-700"
                      : step.active
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {step.name}
                </span>
                
                {/* Status indicator */}
                <div className="mt-1">
                  {step.completed && (
                    <span className="text-[10px] text-green-600 font-medium">✓ Done</span>
                  )}
                  {step.active && (
                    <span className="text-[10px] text-red-600 font-medium animate-pulse">● Active</span>
                  )}
                  {!step.completed && !step.active && (
                    <span className="text-[10px] text-gray-400">Pending</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Step Information */}
      {currentStep < totalSteps && (
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Next: {steps[currentStep]?.name} - Complete this step to continue
            </span>
          </div>
        </div>
      )}
      
      {currentStep === totalSteps && (
        <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              All steps completed! Your service request is ready to submit.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveProgressTracker;