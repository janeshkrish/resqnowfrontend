import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star, User } from "lucide-react";
import { format } from "date-fns";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface TechnicianReviewsProps {
  technicianId: string;
}

const TechnicianReviews: React.FC<TechnicianReviewsProps> = ({ technicianId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stubbing reviews for now as we don't have reviews backend
  useEffect(() => {
    setReviews([]);
  }, [technicianId]);

  if (isLoading) {
    return <div className="space-y-3">Loading reviews...</div>;
  }

  if (reviews.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-4">
        No reviews yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id} className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                        }`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(review.created_at), "MMM d, yyyy")}
              </span>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TechnicianReviews;
