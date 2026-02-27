import React from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface Review {
    id: string;
    reviewer_name: string;
    rating: number;
    comment: string;
    created_at: string;
}

interface TechnicianReviewsProps {
    reviews: Review[];
}

const TechnicianReviews: React.FC<TechnicianReviewsProps> = ({ reviews }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    Customer Reviews
                </CardTitle>
            </CardHeader>
            <CardContent>
                {reviews.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No reviews yet.</p>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-sm">{review.reviewer_name}</span>
                                    <div className="flex items-center">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-3 w-3 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3">{review.comment}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TechnicianReviews;
