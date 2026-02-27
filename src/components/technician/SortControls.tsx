
import { Clock, Star } from "lucide-react";
import { Button } from "../ui/button";

interface SortControlsProps {
  sortBy: "price" | "rating" | "arrival";
  onSortChange: (sort: "price" | "rating" | "arrival") => void;
}

const SortControls = ({ sortBy, onSortChange }: SortControlsProps) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      <Button 
        variant={sortBy === "arrival" ? "default" : "outline"} 
        size="sm" 
        onClick={() => onSortChange("arrival")}
        className={sortBy === "arrival" ? "bg-red-600 hover:bg-red-700" : ""}
      >
        <Clock className="mr-1 h-4 w-4" />
        Fastest Arrival
      </Button>
      <Button 
        variant={sortBy === "price" ? "default" : "outline"} 
        size="sm" 
        onClick={() => onSortChange("price")}
        className={sortBy === "price" ? "bg-red-600 hover:bg-red-700" : ""}
      >
        Price: Low to High
      </Button>
      <Button 
        variant={sortBy === "rating" ? "default" : "outline"} 
        size="sm" 
        onClick={() => onSortChange("rating")}
        className={sortBy === "rating" ? "bg-red-600 hover:bg-red-700" : ""}
      >
        <Star className="mr-1 h-4 w-4" />
        Top Rated
      </Button>
    </div>
  );
};

export default SortControls;
