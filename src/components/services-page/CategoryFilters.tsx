
import { cn } from "@/lib/utils";
import { VehicleCategory } from "./types";

type CategoryFiltersProps = {
  categories: VehicleCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
};

const CategoryFilters = ({ categories, selectedCategory, onSelectCategory }: CategoryFiltersProps) => {
  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 mb-2">
      {categories.map((category) => (
        <button
          key={category.id}
          className={cn(
            "px-5 py-2.5 rounded-[1.25rem] text-sm font-bold transition-all border flex items-center gap-2 shrink-0 shadow-sm",
            selectedCategory === category.id
              ? "bg-slate-900 text-white border-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.2)]"
              : "bg-card dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted active:scale-95"
          )}
          onClick={() => onSelectCategory(category.id)}
        >
          {category.icon && <category.icon className={cn("h-4 w-4", selectedCategory === category.id ? "text-white" : "text-slate-400")} />}
          {category.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilters;
