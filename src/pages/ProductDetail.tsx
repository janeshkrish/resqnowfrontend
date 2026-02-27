import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Heart, Share2, Star, Truck, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  wholesale_price: number;
  retail_price: number;
  stock_quantity: number;
  min_order_quantity: number;
  images: string[];
  vehicle_compatibility: string[];
  category: { name: string; description: string };
}

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [priceType, setPriceType] = useState<"retail" | "wholesale">("retail");
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  useEffect(() => {
    // Product detail feature disabled - tables not yet created
    toast.info("Product details coming soon!");
  }, [id]);

  const fetchProduct = async () => {
    // Disabled - table not created yet
    setLoading(false);
  };

  const addToCart = async () => {
    // Disabled - table not created yet
    toast.info("Cart feature coming soon!");
    setIsAddingToCart(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
        <div className="container px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product not found</h1>
          <Button asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentPrice = priceType === "retail" ? product.retail_price : product.wholesale_price;
  const savings = product.retail_price - product.wholesale_price;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/marketplace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden">
              {product.images.length > 0 ? (
                <img
                  src={product.images[selectedImage]}

                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No Image Available
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === index ? 'border-primary' : 'border-transparent'
                      }`}

                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <Badge variant="secondary" className="mb-2">{product.category?.name}</Badge>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <p className="text-lg text-muted-foreground">{product.brand}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="text-sm text-muted-foreground ml-2">(4.8) 124 reviews</span>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPriceType("retail")}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${priceType === "retail" ? 'border-primary bg-primary/5' : 'border-border'
                      }`}

                  >
                    <div className="font-semibold">Retail Price</div>
                    <div className="text-2xl font-bold text-primary">₹{product.retail_price}</div>
                    <div className="text-sm text-muted-foreground">Per unit</div>
                  </button>
                  <button
                    onClick={() => setPriceType("wholesale")}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${priceType === "wholesale" ? 'border-primary bg-primary/5' : 'border-border'
                      }`}

                  >
                    <div className="font-semibold">Wholesale Price</div>
                    <div className="text-2xl font-bold text-primary">₹{product.wholesale_price}</div>
                    <div className="text-sm text-muted-foreground">Min qty: {product.min_order_quantity}</div>
                  </button>
                </div>

                {priceType === "wholesale" && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Save ₹{savings} per unit with wholesale pricing!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add to Cart */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="font-medium">Quantity:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"

                      size="sm"
                      onClick={() => setQuantity(Math.max(product.min_order_quantity, quantity - 1))}
                      disabled={quantity <= product.min_order_quantity}
                    >
                      -
                    </Button>
                    <Input
                      type="number"

                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.min_order_quantity, parseInt(e.target.value) || product.min_order_quantity))}
                      className="w-20 text-center"
                      min={product.min_order_quantity}
                    />
                    <Button
                      variant="outline"

                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={quantity >= product.stock_quantity}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-primary">₹{(currentPrice * quantity).toLocaleString()}</span>
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1"

                    size="lg"
                    onClick={addToCart}
                    disabled={product.stock_quantity === 0 || isAddingToCart}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isAddingToCart ? "Adding..." : "Add to Cart"}
                  </Button>
                  <Button variant="outline" size="lg">
                    <Heart className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="lg">
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    <span>Free shipping on orders over ₹2000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <Badge variant={product.stock_quantity > 0 ? "secondary" : "destructive"}>
                {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}
              </Badge>
              {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
                <Badge variant="outline" className="text-orange-600">
                  Low stock
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="specifications" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Detailed specifications will be available soon.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compatibility" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Compatibility</CardTitle>
                </CardHeader>
                <CardContent>
                  {product.vehicle_compatibility.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {product.vehicle_compatibility.map((type) => (
                        <Badge key={type} variant="outline" className="px-3 py-1">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Universal compatibility</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipping" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-lg">
                    <Truck className="h-6 w-6 text-primary" />
                    <div>
                      <h4 className="font-medium">Free Shipping</h4>
                      <p className="text-sm text-muted-foreground">On orders over ₹2000</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                    <div>
                      <h4 className="font-medium">Secure Packaging</h4>
                      <p className="text-sm text-muted-foreground">Items are carefully packaged</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-lg">
                    <RefreshCw className="h-6 w-6 text-primary" />
                    <div>
                      <h4 className="font-medium">Easy Returns</h4>
                      <p className="text-sm text-muted-foreground">30-day return policy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Reviews feature coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;