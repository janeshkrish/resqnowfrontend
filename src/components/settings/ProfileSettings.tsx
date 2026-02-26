
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Camera, Mail, Phone, User as UserIcon, Calendar, ShieldCheck, Edit2, ChevronRight } from "lucide-react"

const ProfileSettings = () => {
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthday: "",
    gender: "",
    avatar: ""
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : "",
        gender: user.gender || "",
        avatar: ""
      });
    }
  }, [user]);

  const handleEdit = (field: string) => {
    setIsEditing(field);
  };

  const handleSave = async (field: string) => {
    try {
      const updateData: any = {};
      if (field === 'birthday') updateData.birthday = formData.birthday;
      if (field === 'gender') updateData.gender = formData.gender;
      if (field === 'phone') updateData.phone = formData.phone;
      if (field === 'name') updateData.name = formData.name;

      await updateProfile(updateData);
      setIsEditing(null);
    } catch (error) {
      // Error handled in updateProfile
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Section - Zomato Style Banner */}
      <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 bg-card dark:bg-slate-900 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/50 mb-6">
        <div className="relative group cursor-pointer">
          <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
            <AvatarImage src={formData.avatar} />
            <AvatarFallback className="text-4xl bg-blue-600 text-white">
              {formData.name.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">{formData.name}</h2>
          <p className="text-muted-foreground/80 font-medium">{formData.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Basic Info Card */}
        <div className="zomato-card">
          <div className="pb-4 border-b border-border mb-2">
            <h3 className="text-lg font-bold text-foreground">Personal Details</h3>
            <p className="text-xs text-muted-foreground/80">Your information</p>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Name Row */}
            <div className="flex items-center justify-between py-4 group">
              <div className="flex flex-col w-1/3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Name</span>
              </div>
                <div className="flex-1 font-medium text-foreground">
                  {isEditing === 'name' ? (
                    <div className="flex gap-2">
                      <Input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="h-8 w-64"
                      />
                      <Button size="sm" onClick={() => handleSave('name')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                    </div>
                  ) : formData.name}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground/60 group-hover:text-muted-foreground" onClick={() => handleEdit('name')}>
                  <Edit2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Birthday Row */}
            <div className="flex items-center justify-between py-4 group">
              <div className="flex flex-col w-1/3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Birthday</span>
              </div>
                <div className="flex-1 font-medium text-foreground">
                  {isEditing === 'birthday' ? (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        name="birthday"
                        value={formData.birthday}
                        onChange={handleChange}
                        className="h-8 w-64"
                      />
                      <Button size="sm" onClick={() => handleSave('birthday')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                    </div>
                  ) : (formData.birthday || "Add birthday")}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground/60 group-hover:text-muted-foreground" onClick={() => handleEdit('birthday')}>
                  <Edit2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Gender Row */}
            <div className="flex items-center justify-between py-4 group">
              <div className="flex flex-col w-1/3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Gender</span>
              </div>
                <div className="flex-1 font-medium text-foreground">
                  {isEditing === 'gender' ? (
                    <div className="flex gap-2">
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="h-8 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <Button size="sm" onClick={() => handleSave('gender')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                    </div>
                  ) : (formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : "Add gender")}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground/60 group-hover:text-muted-foreground" onClick={() => handleEdit('gender')}>
                  <Edit2 className="h-4 w-4" />
                </Button>
            </div>
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="zomato-card">
          <div className="pb-4 border-b border-border mb-2">
            <h3 className="text-lg font-bold text-foreground">Contact Details</h3>
            <p className="text-xs text-muted-foreground/80">How we can reach you</p>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Email Row */}
            <div className="flex items-center justify-between py-4 group">
              <div className="flex flex-col w-1/3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Email</span>
              </div>
                <div className="flex-1 font-medium text-foreground">
                  {formData.email}
                  {user?.isVerified && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground/60 group-hover:text-muted-foreground" disabled>
                  <ShieldCheck className="h-4 w-4" />
                </Button>
            </div>

            {/* Phone Row */}
            <div className="flex items-center justify-between py-4 group">
              <div className="flex flex-col w-1/3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Phone</span>
              </div>
                <div className="flex-1 font-medium text-foreground">
                  {isEditing === 'phone' ? (
                    <div className="flex gap-2">
                      <Input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="h-8 w-64"
                        placeholder="e.g. 9876543210"
                      />
                      <Button size="sm" onClick={() => handleSave('phone')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                    </div>
                  ) : (formData.phone || "Add phone number")}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground/60 group-hover:text-muted-foreground" onClick={() => handleEdit('phone')}>
                  <Edit2 className="h-4 w-4" />
                </Button>
            </div>
          </div>
        </div>

        {/* Security / Account Card */}
        <div className="zomato-card bg-blue-50/30 border-blue-100/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                Account Security
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Your account is protected. We regularly check for security risks to keep your personal data safe.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default ProfileSettings
