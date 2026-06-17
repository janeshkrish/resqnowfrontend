import re

file_path = 'd:/ResQNow all files/resqnow production code/resqnowfrontend/src/components/technician/TechnicianSignupWizard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 3. Replace Step 1 Services with dynamic template.services
step1_old = r'\{ALL_SERVICES\.map\(\(service\) => \{.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\}\)\}'

new_step1 = """{pricingTemplate?.services?.map((service: any) => {
                                        const isSelected = selectedServices.includes(service.id.toString());
                                        return (
                                            <button
                                                key={service.id}
                                                type="button"
                                                onClick={() => toggleService(service.id.toString())}
                                                className={cn(
                                                    "group relative overflow-hidden rounded-[1.5rem] border text-left transition-all duration-300",
                                                    isSelected ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
                                                )}
                                            >
                                                <div className="p-5 relative z-10 h-full flex flex-col">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className={cn("p-3 rounded-2xl transition-colors", isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
                                                            <Wrench className="w-6 h-6" />
                                                        </div>
                                                        <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all", isSelected ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                    <h3 className={cn("font-bold text-[15px] mb-1.5 transition-colors", isSelected ? "text-primary" : "text-foreground")}>{service.service_name}</h3>
                                                </div>
                                            </button>
                                        );
                                    })}"""

content = re.sub(r'\{ALL_SERVICES\.map\(\(service\) => \{.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\}\)\}', new_step1, content, flags=re.DOTALL)


# 4. Replace Step 4 Pricing with DynamicPricingStep
step4_old = r'\{currentStep === 4 && \(\n.*?\{selectedServices\.map\(\(s, i\) => \(\n.*?\<ServiceConfigCard\n.*?serviceId=\{s\}\n.*?index=\{i\}\n.*?register=\{register\}\n.*?watch=\{watch\}\n.*?setValue=\{setValue\}\n.*?selectedVehicleTypes=\{selectedVehicleTypes\}\n.*?\/\>\n.*?\)\}\n.*?\)\}\n.*?\}\)'

new_step4 = """{currentStep === 4 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-900/20 p-4 rounded-[1.5rem] border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 shadow-sm">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                                    <div>
                                        <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Dynamic Base Pricing Config</h4>
                                        <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">Set your standard base prices.</p>
                                    </div>
                                </div>
                                <DynamicPricingStep 
                                    services={pricingTemplate?.services || []} 
                                    categories={pricingTemplate?.categories || []} 
                                    pricingFields={pricingTemplate?.pricingFields || []} 
                                    selectedServiceIds={selectedServices.map((id: string) => parseInt(id, 10))} 
                                    onChange={(data: any) => setValue('pricing_config', data)} 
                                />
                            </div>
                        )}"""

content = re.sub(step4_old, new_step4, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Update complete")
