import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function TechnicianDynamicPricing({ technicianId }: { technicianId: string }) {
    const [template, setTemplate] = useState<any>(null);
    const [pricingData, setPricingData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const tplRes = await apiFetch("/api/technicians/pricing-template");
                if (tplRes.ok) setTemplate(await tplRes.json());

                const prcRes = await apiFetch(`/api/technicians/${technicianId}/service-pricing`, { admin: true });
                if (prcRes.ok) setPricingData(await prcRes.json());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [technicianId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Need an endpoint to save admin pricing. We'll use the same structure:
            const res = await apiFetch(`/api/technicians/${technicianId}/service-pricing`, {
                method: "POST",
                admin: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pricing_data: pricingData })
            });
            if (res.ok) {
                toast.success("Pricing saved successfully");
            } else {
                toast.error("Failed to save pricing");
            }
        } catch (err) {
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const addRow = () => {
        setPricingData([...pricingData, { service_id: "", vehicle_category_id: "", pricing_json: {} }]);
    };

    const removeRow = (idx: number) => {
        setPricingData(pricingData.filter((_, i) => i !== idx));
    };

    const updateRow = (idx: number, field: string, value: any) => {
        const newData = [...pricingData];
        newData[idx][field] = value;
        setPricingData(newData);
    };

    const updatePricingJson = (idx: number, key: string, value: any) => {
        const newData = [...pricingData];
        newData[idx].pricing_json = { ...newData[idx].pricing_json, [key]: Number(value) };
        setPricingData(newData);
    };

    if (loading) return <div>Loading pricing...</div>;
    if (!template) return <div>Error loading pricing template.</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Dynamic Service Pricing</h3>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-2"/> Add Row</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Pricing
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {pricingData.length === 0 && <p className="text-muted-foreground text-sm">No pricing configured yet.</p>}
                {pricingData.map((row, idx) => {
                    const svc = template.services.find((s: any) => s.id === Number(row.service_id));
                    const fields = template.pricingFields.filter((f: any) => f.service_id === Number(row.service_id));

                    return (
                        <div key={idx} className="border p-4 rounded-md space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium">Service</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={row.service_id}
                                        onChange={(e) => updateRow(idx, "service_id", e.target.value)}
                                    >
                                        <option value="">Select Service</option>
                                        {template.services.map((s: any) => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Vehicle Category</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={row.vehicle_category_id}
                                        onChange={(e) => updateRow(idx, "vehicle_category_id", e.target.value)}
                                    >
                                        <option value="">Select Category</option>
                                        {template.categories.map((c: any) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            {fields.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                    {fields.map((f: any) => (
                                        <div key={f.id}>
                                            <label className="text-xs font-medium">{f.field_label}</label>
                                            <Input
                                                type="number"
                                                value={row.pricing_json?.[f.field_key] || ""}
                                                onChange={(e) => updatePricingJson(idx, f.field_key, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeRow(idx)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
