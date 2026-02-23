import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  Upload,
  Store,
  Wrench,
  LayoutGrid,
  Building2,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShopVerificationData {
  shopImage: File | null;
  equipmentImage: File | null;
  workingBayImage: File | null;
  facilitiesImage: File | null;
  gstinNumber: string;
}

interface ShopVerificationStepProps {
  data: ShopVerificationData;
  onChange: (data: ShopVerificationData) => void;
  errors: Record<string, string>;
  showErrors: boolean;
}

interface ImageUploadCardProps {
  label: string;
  description: string;
  icon: React.ElementType;
  file: File | null;
  onFileChange: (file: File | null) => void;
  required?: boolean;
  hasError?: boolean;
}

function ImageUploadCard({
  label,
  description,
  icon: Icon,
  file,
  onFileChange,
  required,
  hasError,
}: ImageUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onFileChange(selectedFile);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-primary/50",
        file ? "border-primary bg-primary/5" : "border-dashed border-border",
        hasError && "border-destructive"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full">
            <FileText className="h-8 w-8 text-primary" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-medium truncate max-w-full">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon className="h-10 w-10 text-muted-foreground" />
          <div>
            <span className="font-medium">
              {label} {required && "*"}
            </span>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <Button type="button" variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </Button>
        </div>
      )}
    </div>
  );
}

export function ShopVerificationStep({
  data,
  onChange,
  errors,
  showErrors,
}: ShopVerificationStepProps) {
  const handleImageChange = (
    field: keyof ShopVerificationData,
    file: File | null
  ) => {
    onChange({ ...data, [field]: file });
  };

  return (
    <Card className="border-2 border-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shop Verification
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload images to verify your shop and facilities
            </p>
          </div>

          {showErrors && errors.shopImage && (
            <p className="text-sm text-destructive">{errors.shopImage}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploadCard
              label="Shop Front Image"
              description="Photo of your shop entrance"
              icon={Camera}
              file={data.shopImage}
              onFileChange={(file) => handleImageChange("shopImage", file)}
              required
              hasError={showErrors && !!errors.shopImage}
            />
            <ImageUploadCard
              label="Equipment Image"
              description="Your tools and equipment"
              icon={Wrench}
              file={data.equipmentImage}
              onFileChange={(file) => handleImageChange("equipmentImage", file)}
            />
            <ImageUploadCard
              label="Working Bay Image"
              description="Your service bay/workspace"
              icon={LayoutGrid}
              file={data.workingBayImage}
              onFileChange={(file) =>
                handleImageChange("workingBayImage", file)
              }
            />
            <ImageUploadCard
              label="Facilities Image"
              description="Additional facility photos"
              icon={Building2}
              file={data.facilitiesImage}
              onFileChange={(file) =>
                handleImageChange("facilitiesImage", file)
              }
            />
          </div>

          <div className="space-y-2 max-w-md">
            <Label htmlFor="gstinNumber">GSTIN Number (Optional)</Label>
            <Input
              id="gstinNumber"
              value={data.gstinNumber}
              onChange={(e) => onChange({ ...data, gstinNumber: e.target.value })}
              placeholder="22AAAAA0000A1Z5"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Providing GSTIN helps build trust with customers and enables
              invoicing
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
