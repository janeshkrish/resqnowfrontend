 
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiFetch } from "@/lib/api";
import TechnicianReviews from "@/components/technician/TechnicianReviews";
import { Skeleton } from "@/components/ui/skeleton";

const TechnicianReviewsPage = () => {
    const { technician, token } = useTechnicianAuth();
    const { socket } = useSocket();
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = useCallback(async () => {
        if (!technician || !token) return;
        try {
            const res = await apiFetch(`/api/technicians/me/reviews`, { technician: true });
            if (res.ok) {
                const reviewsData = await res.json();
                if (Array.isArray(reviewsData)) {
                    setReviews(reviewsData);
                }
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [technician, token]);

    useEffect(() => {
        if (technician && token) {
            fetchReviews();
        }
    }, [technician, token, fetchReviews]);

    useEffect(() => {
        if (!technician || !token) return;
        const id = setInterval(fetchReviews, 30000);
        return () => clearInterval(id);
    }, [technician, token, fetchReviews]);

    useEffect(() => {
        if (!socket || !technician?.id) return;

        const handleNewReview = (review: any) => {
            setReviews((prev) => {
                const nextId = String(review?.id || "");
                if (!nextId) return prev;
                if (prev.some((row) => String(row?.id || "") === nextId)) {
                    return prev;
                }
                return [review, ...prev];
            });
        };

        const refresh = () => fetchReviews();

        socket.on("technician:new_review", handleNewReview);
        socket.on("connect", refresh);

        return () => {
            socket.off("technician:new_review", handleNewReview);
            socket.off("connect", refresh);
        };
    }, [socket, technician?.id, fetchReviews]);

    // Calculate generic aggregate rating if not provided by backend
    const averageRating = reviews.length > 0
        ? (reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length).toFixed(1)
        : "0.0";

    return (
        <div className="container max-w-4xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/technician/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
                </Button>
                <h1 className="text-2xl font-bold text-foreground">Customer Reviews</h1>
            </div>

            {loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : (
                <>
                    <Card className="bg-amber-50 border-amber-100">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-16 w-16 bg-card dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                                <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-foreground">{averageRating}</div>
                                <p className="text-muted-foreground/80 font-medium">Average Rating ({reviews.length} reviews)</p>
                            </div>
                        </CardContent>
                    </Card>

                    <TechnicianReviews reviews={reviews} />
                </>
            )}
        </div>
    );
};

export default TechnicianReviewsPage;
