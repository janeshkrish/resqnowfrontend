interface Step {
  id: number;
  name: string;
  description: string;
}

interface ProgressStepperProps {
  currentStep: number;
  steps: Step[];
}

const ProgressStepper = ({ currentStep, steps }: ProgressStepperProps) => {
  const activeStep = steps[currentStep - 1];
  const activeLabel = activeStep?.name || "";

  return (
    <div className="w-full px-4 pb-3 pt-3 md:px-8 md:pb-6 md:pt-6">
      <div className="mb-2.5 flex items-center justify-between gap-3 md:mb-3 md:gap-4">
        <span className="text-[0.82rem] font-semibold text-primary md:text-base">
          Step {currentStep} of {steps.length}
        </span>
        <span className="text-[0.82rem] font-medium tracking-tight text-foreground md:text-base">
          {activeLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {steps.map((step, index) => {
          const isFilled = index < currentStep;

          return (
            <div
              key={step.id}
              className="h-1 flex-1 overflow-hidden rounded-full bg-[#E6EAF1] md:h-1.5"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${isFilled ? "bg-primary" : "bg-transparent"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressStepper;
