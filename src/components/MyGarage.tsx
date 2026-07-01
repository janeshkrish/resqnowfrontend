import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Car, Bike, Trash2, Plus, Loader2, ArrowLeft, Fuel, Gauge, Zap, Trophy, PlusCircle } from "lucide-react";
import { indianVehicleBrands, getCarBrands, getBikeBrands } from "@/data/indianVehicles";
import { getBrandLogoSrc, handleBrandLogoError } from "@/lib/brandLogo";

export interface Vehicle {
    id: number;
    type: string;
    make: string;
    model: string;
    license_plate: string;
    status?: string;
}

const MyGarage = () => {
    const { user } = useAuth();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);

    // Wizard State
    const [isAdding, setIsAdding] = useState(false);
    const [step, setStep] = useState(1); // 1: Type, 2: Brand, 3: Model, 4: Details

    const [newVehicle, setNewVehicle] = useState({
        type: "",
        make: "",
        model: "",
        license_plate: ""
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        fetchVehicles();
        const intervalId = window.setInterval(fetchVehicles, 20000);
        return () => window.clearInterval(intervalId);
    }, [user?.id]);

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/vehicles`);
            if (res.ok) {
                const data = await res.json();
                setVehicles(data);
            }
        } catch (err) {
            console.error("Failed to fetch vehicles", err);
        } finally {
            setLoading(false);
        }
    };

    const resetWizard = () => {
        setIsAdding(false);
        setStep(1);
        setNewVehicle({ type: "", make: "", model: "", license_plate: "" });
    };

    const handleTypeSelect = (type: string) => {
        setNewVehicle({ ...newVehicle, type });
        setStep(2);
    };

    const handleBrandSelect = (brandName: string) => {
        setNewVehicle({ ...newVehicle, make: brandName });
        setStep(3);
    };

    const handleModelSelect = (modelName: string) => {
        setNewVehicle({ ...newVehicle, model: modelName });
        setStep(4);
    };

    const handleAddVehicle = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        try {
            const res = await apiFetch("/api/vehicles", {
                method: "POST",
                body: JSON.stringify({
                    ...newVehicle
                })
            });

            if (res.ok) {
                toast.success("New machine added to garage!");
                resetWizard();
                fetchVehicles();
            } else {
                toast.error("Failed to park vehicle");
            }
        } catch (err) {
            console.error("Error adding vehicle", err);
            toast.error("Ignition failed. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await apiFetch(`/api/vehicles/${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                toast.success("Vehicle removed from collection");
                fetchVehicles();
            } else {
                toast.error("Failed to sell vehicle");
            }
        } catch (err) {
            console.error("Error removing vehicle", err);
        }
    };

    const getBrands = () => {
        return newVehicle.type === 'car' ? getCarBrands() : getBikeBrands();
    };

    const getModels = () => {
        const brand = indianVehicleBrands.find(b => b.name === newVehicle.make);
        return brand ? brand.models : [];
    };

    const getStatusMeta = (status: string | undefined) => {
        const normalized = String(status || "ready").toLowerCase();
        if (normalized === "maintenance") {
            return {
                label: "Maintenance",
                className: "text-amber-600"
            };
        }
        if (normalized === "inactive") {
            return {
                label: "Inactive",
                className: "text-muted-foreground/80"
            };
        }
        return {
            label: "Ready",
            className: "text-green-600"
        };
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            {!isAdding && (
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                            My Collection
                        </h2>
                        <p className="text-muted-foreground/80 flex items-center gap-2 mt-1">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            {vehicles.length} {vehicles.length === 1 ? 'Machine' : 'Machines'} in Garage
                        </p>
                    </div>
                </div>
            )}

            {isAdding ? (
                // Add Vehicle Wizard (Enhanced UI)
                <Card className="border border-border shadow-xl overflow-hidden max-w-3xl mx-auto">
                    <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (step > 1) setStep(step - 1);
                                    else setIsAdding(false);
                                }}
                                className="text-slate-300 hover:text-white hover:bg-card dark:bg-slate-900/10"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                            </Button>
                            <div>
                                <h3 className="font-bold text-lg">Acquire New Vehicle</h3>
                                <p className="text-slate-400 text-sm">Step {step}:
                                    {step === 1 && " Select Class"}
                                    {step === 2 && " Choose Manufacturer"}
                                    {step === 3 && " Select Model"}
                                    {step === 4 && " Registration"}
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:flex gap-1">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={`h-2 w-12 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-slate-700'}`} />
                            ))}
                        </div>
                    </div>

                    <CardContent className="p-8 min-h-[400px]">
                        {/* Step 1: Type Selection */}
                        {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
                                <button
                                    onClick={() => handleTypeSelect("car")}
                                    className="group relative h-64 overflow-hidden rounded-2xl border-2 border-border hover:border-primary transition-all shadow-sm hover:shadow-xl"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-indigo-100 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
                                        <div className="bg-card dark:bg-slate-900 p-6 rounded-full shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                                            <Car className="h-12 w-12 text-red-600" />
                                        </div>
                                        <h4 className="text-2xl font-bold text-foreground">4-Wheeler</h4>
                                        <p className="text-muted-foreground/80 mt-2">Cars, SUVs, & Trucks</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleTypeSelect("bike")}
                                    className="group relative h-64 overflow-hidden rounded-2xl border-2 border-border hover:border-primary transition-all shadow-sm hover:shadow-xl"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-100 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
                                        <div className="bg-card dark:bg-slate-900 p-6 rounded-full shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                                            <Bike className="h-12 w-12 text-orange-600" />
                                        </div>
                                        <h4 className="text-2xl font-bold text-foreground">2-Wheeler</h4>
                                        <p className="text-muted-foreground/80 mt-2">Motorcycles & Scooters</p>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Step 2: Brand Selection */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <h4 className="text-xl font-bold text-foreground mb-6">Select Manufacturer</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                    {getBrands().map((brand) => (
                                        <button
                                            key={brand.id}
                                            onClick={() => handleBrandSelect(brand.name)}
                                            className="flex flex-col items-center p-4 border rounded-xl hover:border-primary hover:shadow-lg transition-all bg-card dark:bg-slate-900 aspect-square justify-center gap-3 group"
                                        >
                                            <img
                                                src={getBrandLogoSrc(brand.logo)}
                                                alt={brand.name}
                                                className="w-16 h-16 object-contain grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110"
                                                loading="lazy"
                                                onError={handleBrandLogoError}
                                            />
                                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground">{brand.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Model Selection */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-muted p-4 rounded-xl border border-border">
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground/80">Manufacturer:</span>
                                        <span className="font-bold text-xl text-foreground">{newVehicle.make}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                                        Change
                                    </Button>
                                </div>

                                <h4 className="text-lg font-semibold text-foreground">Select Model</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                    {getModels().map((model) => (
                                        <button
                                            key={model}
                                            onClick={() => handleModelSelect(model)}
                                            className="text-left px-5 py-4 border rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-colors text-sm font-semibold text-muted-foreground shadow-sm"
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Final Details */}
                        {step === 4 && (
                            <div className="max-w-md mx-auto space-y-8 py-8">
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                                        <Car className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-foreground">Almost There!</h3>
                                    <p className="text-muted-foreground/80">Confirm details to add to your garage.</p>
                                </div>

                                <div className="bg-muted p-6 rounded-2xl border border-border">
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-xs text-muted-foreground/80 uppercase font-bold tracking-wider">Make</p>
                                            <p className="text-lg font-bold text-foreground">{newVehicle.make}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground/80 uppercase font-bold tracking-wider">Model</p>
                                            <p className="text-lg font-bold text-foreground">{newVehicle.model}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="uppercase text-xs font-bold text-muted-foreground/80 tracking-wider">License Plate (Optional)</Label>
                                        <Input
                                            value={newVehicle.license_plate}
                                            onChange={(e) => setNewVehicle({ ...newVehicle, license_plate: e.target.value })}
                                            placeholder="IND-555"
                                            className="text-center text-2xl uppercase tracking-[0.2em] font-mono h-14 bg-card dark:bg-slate-900 border-2 border-border focus:border-primary"
                                        />
                                    </div>
                                </div>

                                <Button
                                    className="w-full py-6 text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl"
                                    onClick={handleAddVehicle}
                                    disabled={submitting}
                                >
                                    {submitting ? <Loader2 className="animate-spin mr-2" /> : "Park in Garage"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                // Showroom Grid View
                <>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground/80 font-medium">Valet retrieving vehicles...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Empty Bay Card (Add Button) */}
                            <button
                                onClick={() => setIsAdding(true)}
                                className="group relative border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-8 hover:border-primary hover:bg-primary/5 transition-all duration-300 min-h-[300px]"
                            >
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-card dark:bg-slate-900 group-hover:scale-110 transition-transform shadow-sm group-hover:shadow-md mb-4">
                                    <Plus className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-muted-foreground group-hover:text-primary transition-colors">Empty Bay</h3>
                                <p className="text-sm text-slate-400 group-hover:text-primary/70">Park a new vehicle here</p>
                            </button>

                            {/* Vehicle Cards */}
                            {vehicles.map((v) => {
                                const brand = indianVehicleBrands.find(b => b.name === v.make);
                                const isCar = v.type === 'car';
                                const statusMeta = getStatusMeta(v.status);

                                return (
                                    <div key={v.id} className="group relative bg-card dark:bg-slate-900 rounded-2xl border border-border shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                                        {/* Brand Header */}
                                        <div className="relative h-32 bg-slate-900 overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-black opacity-80" />
                                            {/* Decorative Background Pattern */}
                                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />

                                            <div className="absolute top-4 right-4 z-10">
                                                {brand?.logo && (
                                                    <div className="bg-card dark:bg-slate-900/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                                                        <img
                                                            src={getBrandLogoSrc(brand.logo)}
                                                            alt={brand.name}
                                                            className="w-8 h-8 object-contain"
                                                            onError={handleBrandLogoError}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="absolute bottom-4 left-4 z-10">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isCar ? 'bg-red-500/20 text-red-100 border border-red-500/30' : 'bg-orange-500/20 text-orange-100 border border-orange-500/30'}`}>
                                                        {v.type}
                                                    </span>
                                                </div>
                                                <h3 className="text-2xl font-black text-white tracking-tight mt-1">
                                                    {v.make}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Content Body */}
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="mb-6">
                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Model Spec</p>
                                                <h4 className="text-xl font-bold text-foreground">{v.model}</h4>
                                            </div>

                                            {/* Spec Grid */}
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div className="bg-muted p-3 rounded-lg border border-border">
                                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                        <Gauge className="h-3 w-3" />
                                                        <span className="text-[10px] uppercase font-bold">Registration</span>
                                                    </div>
                                                    <p className="font-mono font-bold text-muted-foreground text-sm">
                                                        {v.license_plate || "N/A"}
                                                    </p>
                                                </div>
                                                <div className="bg-muted p-3 rounded-lg border border-border">
                                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                        <Fuel className="h-3 w-3" />
                                                        <span className="text-[10px] uppercase font-bold">Status</span>
                                                    </div>
                                                    <p className={`font-bold text-sm flex items-center gap-1 ${statusMeta.className}`}>
                                                        <Zap className="h-3 w-3" /> {statusMeta.label}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-auto flex gap-2">
                                                <Button className="flex-1 font-bold bg-slate-900 text-white hover:bg-slate-800">
                                                    Book Service
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                                                    onClick={() => handleDelete(v.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MyGarage;
