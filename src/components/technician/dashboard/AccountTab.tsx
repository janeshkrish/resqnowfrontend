
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AccountTabProps {
  technician: {
    name: string;
    email: string;
    phone: string;
    experience: number;
    specialties: string[];
  };
}

const AccountTab: React.FC<AccountTabProps> = ({ technician }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>
          Manage your technician profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Profile Information</h3>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <p className="text-sm font-medium">Name:</p>
              <p className="col-span-2 text-sm">{technician.name}</p>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <p className="text-sm font-medium">Email:</p>
              <p className="col-span-2 text-sm">{technician.email}</p>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <p className="text-sm font-medium">Phone:</p>
              <p className="col-span-2 text-sm">{technician.phone}</p>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <p className="text-sm font-medium">Experience:</p>
              <p className="col-span-2 text-sm">{technician.experience} years</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Service Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {technician.specialties.map((specialty) => (
              <div key={specialty} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                {specialty}
              </div>
            ))}
          </div>
        </div>
        
        <div className="pt-4">
          <Button>Edit Profile</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountTab;
