import { useState, useEffect } from "react";
import { Search, Filter, ShoppingCart, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  wholesale_price: number;
  retail_price: number;
  stock_quantity: number;
  images: string[];
  vehicle_compatibility: string[];
  category: { name: string };
}

const Marketplace = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceType, setPriceType] = useState<"retail" | "wholesale">("retail");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Marketplace feature disabled - tables not yet created
    toast.info("Marketplace coming soon!");
  }, []);

  const fetchCategories = async () => {
    // Disabled - table not created yet
  };

  const fetchProducts = async () => {
    // Disabled - table not created yet
    setLoading(false);
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === "all" || product.category?.name === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-accent to-primary py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container relative z-10 px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Auto Parts Marketplace
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Premium tyres and automobile spares at wholesale and retail prices
          </p>
          <div className="flex justify-center gap-4 mb-8">
            <Badge variant="secondary" className="px-4 py-2 text-lg">
              🔧 Premium Quality
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-lg">
              💰 Best Prices
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-lg">
              🚚 Fast Delivery
            </Badge>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="py-8 bg-card/50 backdrop-blur-sm border-b">
        <div className="container px-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priceType} onValueChange={(value: "retail" | "wholesale") => setPriceType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-12">
        <div className="container px-4">
          {loading ? (
            <div className={`grid ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"} gap-6`}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader>
                    <Skeleton className="h-48 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className={`grid ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"} gap-6`}>
              {filteredProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="p-0">
                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      {product.images.length > 0 ? (
                        <img
                          src={product.images[0]}

                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-muted-foreground">No Image</div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">{product.category?.name}</Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mb-2">{product.brand}</p>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          ₹{priceType === "retail" ? product.retail_price : product.wholesale_price}
                        </p>
                        {priceType === "wholesale" && (
                          <p className="text-sm text-muted-foreground line-through">
                            ₹{product.retail_price}
                          </p>
                        )}
                      </div>
                      <Badge variant={product.stock_quantity > 0 ? "secondary" : "destructive"}>
                        {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}
                      </Badge>
                    </div>

                    {product.vehicle_compatibility.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-1">Compatible with:</p>
                        <div className="flex flex-wrap gap-1">
                          {product.vehicle_compatibility.slice(0, 3).map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {product.vehicle_compatibility.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{product.vehicle_compatibility.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <div className="flex gap-2 w-full">
                      <Button asChild className="flex-1">
                        <Link to={`/marketplace/product/${product.id}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon">
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No products found matching your criteria.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Marketplace;