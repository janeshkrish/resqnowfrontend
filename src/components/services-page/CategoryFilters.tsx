import { cn } from "@/lib/utils";
import { VehicleCategory } from "./types";
import { motion } from "framer-motion";

type CategoryFiltersProps = {
  categories: VehicleCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
};

const CategoryFilters = ({ categories, selectedCategory, onSelectCategory }: CategoryFiltersProps) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 w-full">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id;
        return (
          <button
            key={category.id}
            className={cn(
              "relative px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 flex flex-col items-center gap-3 shrink-0 min-w-[120px]",
              isSelected
                ? "text-blue-700 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.3)] bg-white border border-blue-100"
                : "text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-100"
            )}
            onClick={() => onSelectCategory(category.id)}
          >
            {isSelected && (
              <motion.div 
                layoutId="activeCategoryBg"
                className="absolute inset-0 bg-blue-50/50 rounded-2xl border border-blue-200/50 -z-10"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
              isSelected ? "bg-blue-100 text-blue-600" : "bg-white text-slate-400 shadow-sm"
            )}>
              {category.icon && <category.icon className="h-5 w-5" />}
            </div>
            <span>{category.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilters;
