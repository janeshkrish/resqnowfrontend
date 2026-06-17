import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function DynamicPricingStep({ 
    services, 
    categories, 
    pricingFields, 
    selectedServiceNames,
    onChange 
}: { 
    services: any[]; 
    categories: any[]; 
    pricingFields: any[]; 
    selectedServiceNames: string[];
    onChange: (data: any[]) => void;
}) {
    // pricingData = [{ service_id, vehicle_category_id, pricing_json: {} }]
    const [pricingData, setPricingData] = useState<any[]>([]);

    useEffect(() => {
        onChange(pricingData);
    }, [pricingData, onChange]);

    const activeServices = services.filter(s => selectedServiceNames.includes(s.service_name));

    const handleFieldChange = (svcId: number, catId: number, fieldKey: string, value: string) => {
        setPricingData(prev => {
            const existingIdx = prev.findIndex(p => p.service_id === svcId && p.vehicle_category_id === catId);
            const numVal = Number(value);
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx].pricing_json[fieldKey] = numVal;
                return updated;
            } else {
                return [...prev, {
                    service_id: svcId,
                    vehicle_category_id: catId,
                    pricing_json: { [fieldKey]: numVal }
                }];
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h4 className="font-bold text-amber-900 text-sm">Dynamic Base Pricing Config</h4>
                <p className="text-xs text-amber-800 mt-1">Set your standard base prices for the services you selected.</p>
            </div>

            {activeServices.length === 0 && (
                <div className="text-sm text-muted-foreground">Please select at least one service in Step 1.</div>
            )}

            {activeServices.map(svc => {
                const fields = pricingFields.filter(f => f.service_id === svc.id);
                return (
                    <div key={svc.id} className="border p-4 rounded-xl shadow-sm bg-card space-y-4">
                        <h3 className="font-bold text-lg">{svc.service_name}</h3>
                        
                        <div className="space-y-4">
                            {categories.map(cat => {
                                const rowData = pricingData.find(p => p.service_id === svc.id && p.vehicle_category_id === cat.id);
                                return (
                                    <div key={cat.id} className="border p-3 rounded-lg bg-muted/20">
                                        <h4 className="text-sm font-semibold mb-2">{cat.category_name}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {fields.map(f => (
                                                <div key={f.id} className="space-y-1">
                                                    <Label className="text-xs">{f.field_label}</Label>
                                                    <Input 
                                                        type="number" 
                                                        min="0"
                                                        value={rowData?.pricing_json?.[f.field_key] || ""}
                                                        onChange={e => handleFieldChange(svc.id, cat.id, f.field_key, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
