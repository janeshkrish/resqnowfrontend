import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const AdminServices = () => {
    const [services, setServices] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [subcategories, setSubcategories] = useState<any[]>([]);
    const [pricingFields, setPricingFields] = useState<any[]>([]);
    const [fleets, setFleets] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const [svcRes, catRes, subcatRes, pfRes, fleetRes] = await Promise.all([
                apiFetch("/api/admin/services", { admin: true }),
                apiFetch("/api/admin/vehicle-categories", { admin: true }),
                apiFetch("/api/admin/vehicle-subcategories", { admin: true }),
                apiFetch("/api/admin/pricing-fields", { admin: true }),
                apiFetch("/api/admin/fleets", { admin: true })
            ]);

            if (svcRes.ok) setServices(await svcRes.json());
            if (catRes.ok) setCategories(await catRes.json());
            if (subcatRes.ok) setSubcategories(await subcatRes.json());
            if (pfRes.ok) setPricingFields(await pfRes.json());
            if (fleetRes.ok) setFleets(await fleetRes.json());
        } catch (err) {
            toast.error("Failed to load service configuration data");
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (endpoint: string, id: number) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            const res = await apiFetch(`/api/admin/${endpoint}/${id}`, { method: 'DELETE', admin: true });
            if (res.ok) {
                toast.success("Deleted successfully");
                fetchData();
            } else {
                toast.error("Failed to delete");
            }
        } catch (err) {
            toast.error("An error occurred");
        }
    };

    return (
        <div className="container max-w-full px-4 py-6 md:px-6 md:py-8">
            <h1 className="text-2xl font-bold mb-4">Service Configuration</h1>
            
            <Tabs defaultValue="services" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-2 p-1 bg-muted">
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="subcategories">Subcategories</TabsTrigger>
                    <TabsTrigger value="pricing_fields">Pricing Fields</TabsTrigger>
                    <TabsTrigger value="fleets">Fleets</TabsTrigger>
                </TabsList>

                {/* SERVICES TAB */}
                <TabsContent value="services">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Master Services</CardTitle>
                            <AddServiceModal onSave={fetchData} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Active</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>{s.id}</TableCell>
                                            <TableCell className="font-medium">{s.service_name}</TableCell>
                                            <TableCell>{s.service_slug}</TableCell>
                                            <TableCell>{s.active ? "Yes" : "No"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('services', s.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CATEGORIES TAB */}
                <TabsContent value="categories">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Vehicle Categories</CardTitle>
                            <AddCategoryModal onSave={fetchData} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell>{c.id}</TableCell>
                                            <TableCell className="font-medium">{c.category_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('vehicle-categories', c.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PRICING FIELDS TAB */}
                <TabsContent value="pricing_fields">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Pricing Fields per Service</CardTitle>
                            <AddPricingFieldModal services={services} onSave={fetchData} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Field Key</TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pricingFields.map(pf => {
                                        const svcName = services.find(s => s.id === pf.service_id)?.service_name || "Unknown";
                                        return (
                                        <TableRow key={pf.id}>
                                            <TableCell className="font-medium">{svcName}</TableCell>
                                            <TableCell>{pf.field_key}</TableCell>
                                            <TableCell>{pf.field_label}</TableCell>
                                            <TableCell>{pf.field_type}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('pricing-fields', pf.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FLEETS TAB */}
                <TabsContent value="fleets">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Towing Fleets</CardTitle>
                            <AddFleetModal onSave={fetchData} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Fleet Name</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fleets.map(f => (
                                        <TableRow key={f.id}>
                                            <TableCell>{f.id}</TableCell>
                                            <TableCell className="font-medium">{f.fleet_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('fleets', f.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="subcategories">
                     <Card>
                        <CardHeader>
                            <CardTitle>Vehicle Subcategories</CardTitle>
                            <p className="text-sm text-muted-foreground">Manage subcategories like Hatchback, Sedan for Car category.</p>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Subcategory Name</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subcategories.map(sc => {
                                        const catName = categories.find(c => c.id === sc.vehicle_category_id)?.category_name || "Unknown";
                                        return (
                                        <TableRow key={sc.id}>
                                            <TableCell>{catName}</TableCell>
                                            <TableCell className="font-medium">{sc.subcategory_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('vehicle-subcategories', sc.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
};

// --- Modals ---

const AddServiceModal = ({ onSave }: { onSave: () => void }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiFetch("/api/admin/services", {
            method: "POST",
            admin: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_name: name })
        });
        if (res.ok) {
            toast.success("Service added");
            setOpen(false);
            setName("");
            onSave();
        } else {
            toast.error("Failed to add service");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2"/> Add Service</Button>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New Service</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Service Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AddCategoryModal = ({ onSave }: { onSave: () => void }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiFetch("/api/admin/vehicle-categories", {
            method: "POST",
            admin: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_name: name })
        });
        if (res.ok) {
            toast.success("Category added");
            setOpen(false);
            setName("");
            onSave();
        } else {
            toast.error("Failed to add category");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2"/> Add Category</Button>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Truck" />
                    </div>
                    <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AddPricingFieldModal = ({ services, onSave }: { services: any[], onSave: () => void }) => {
    const [open, setOpen] = useState(false);
    const [svcId, setSvcId] = useState("");
    const [key, setKey] = useState("");
    const [label, setLabel] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiFetch("/api/admin/pricing-fields", {
            method: "POST",
            admin: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_id: parseInt(svcId), field_key: key, field_label: label })
        });
        if (res.ok) {
            toast.success("Pricing field added");
            setOpen(false);
            onSave();
        } else {
            toast.error("Failed to add field");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2"/> Add Field</Button>
            <DialogContent>
                <DialogHeader><DialogTitle>Add Pricing Field</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Service</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={svcId} onChange={e => setSvcId(e.target.value)} required>
                            <option value="">Select a service</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Field Key (e.g. visit_charge)</Label>
                        <Input value={key} onChange={e => setKey(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Display Label (e.g. Visit Charge)</Label>
                        <Input value={label} onChange={e => setLabel(e.target.value)} required />
                    </div>
                    <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AddFleetModal = ({ onSave }: { onSave: () => void }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiFetch("/api/admin/fleets", {
            method: "POST",
            admin: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fleet_name: name })
        });
        if (res.ok) {
            toast.success("Fleet added");
            setOpen(false);
            setName("");
            onSave();
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2"/> Add Fleet</Button>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New Fleet</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Fleet Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AdminServices;
