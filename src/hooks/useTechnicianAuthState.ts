
import { useState, useEffect } from "react";
import { Technician, TechnicianWithPassword } from "@/types/technician";
import { demoTechnicians } from "@/mocks/technicians";

export const useTechnicianAuthState = () => {
  const [technician, setTechnician] = useState<Technician | null>(null);

  useEffect(() => {
    const storedTechnician = localStorage.getItem("resqnow_technician");
    if (storedTechnician) {
      setTechnician(JSON.parse(storedTechnician));
    }
  }, []);

  const login = async (email: string, password: string) => {
    return new Promise<Technician>((resolve, reject) => {
      setTimeout(() => {
        const foundTechnician = demoTechnicians.find(
          (t) => t.email === email && t.password === password
        );
        
        if (foundTechnician) {
          const { password: _, ...technicianWithoutPassword } = foundTechnician;
          setTechnician(technicianWithoutPassword);
          localStorage.setItem("resqnow_technician", JSON.stringify(technicianWithoutPassword));
          resolve(technicianWithoutPassword);
        } else {
          reject(new Error("Invalid email or password"));
        }
      }, 500);
    });
  };

  const register = async (
    name: string, 
    email: string, 
    password: string, 
    phone: string, 
    address: string,
    region: string,
    district: string,
    state: string,
    serviceAreaRange: number,
    experience: number,
    specialties: string[],
    pricing: Record<string, number>
  ) => {
    return new Promise<Technician>((resolve, reject) => {
      setTimeout(() => {
        const existingTechnician = demoTechnicians.find((t) => t.email === email);
        
        if (existingTechnician) {
          reject(new Error("Email already in use"));
        } else {
          const newTechnician: TechnicianWithPassword = {
            id: (demoTechnicians.length + 1).toString(),
            name,
            email,
            password,
            phone,
            address,
            region,
            district,
            state,
            serviceAreaRange,
            experience,
            specialties,
            pricing,
            verification_status: "pending",
          };
          
          demoTechnicians.push(newTechnician);
          
          const { password: _, ...technicianWithoutPassword } = newTechnician;
          setTechnician(technicianWithoutPassword);
          localStorage.setItem("resqnow_technician", JSON.stringify(technicianWithoutPassword));
          resolve(technicianWithoutPassword);
        }
      }, 500);
    });
  };

  const logout = () => {
    setTechnician(null);
    localStorage.removeItem("resqnow_technician");
  };

  return {
    technician,
    isAuthenticated: !!technician,
    login,
    register,
    logout,
  };
};
