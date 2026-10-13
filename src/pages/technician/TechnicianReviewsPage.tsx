import { useCallback, useEffect, useState } from "react";

import { TechBack, TechPage, TechStars } from "@/components/technician/app/TechUi";
import { useSocket } from "@/contexts/SocketContext";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { apiFetch } from "@/lib/api";
import { techDayLabel, techServiceName, useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";
import { buildOrderPerformanceSummary, type DashboardOrderRecord } from "@/utils/technicianDashboard";

// The last job's state, as the performance summary names it, in the technician's words.
const LAST_STATE: Record<string, TechTextKey> = {
    completed: "jobs.state.done",
    paid: "jobs.state.done",
    cancelled: "jobs.state.cancelled",
    rejected: "jobs.state.rejected",
    "in progress": "jobs.state.working",
};

const TechnicianReviewsPage = () => {
    const { technician, token } = useTechnicianAuth();
    const { socket } = useSocket();
    const { lang, t } = useTechText();
    const [reviews, setReviews] = useState<any[]>([]);
    // The technician's requests, for how often they reached on time (the same list Home reads).
    const [requests, setRequests] = useState<DashboardOrderRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = useCallback(async () => {
        if (!technician || !token) return;
        try {
            const [res, requestsRes] = await Promise.all([
                apiFetch(`/api/technicians/me/reviews`, { technician: true }),
                apiFetch("/api/technicians/requests", { technician: true }).catch(() => null),
            ]);
            if (res.ok) {
                const reviewsData = await res.json();
                if (Array.isArray(reviewsData)) {
                    setReviews(reviewsData);
                }
            }
            if (requestsRes?.ok) {
                const requestData = await requestsRes.json();
                if (Array.isArray(requestData)) setRequests(requestData);
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
        ? reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length
        : 0;

    const performance = buildOrderPerformanceSummary(requests);
    const last = performance.lastOrder;
    const lastLate = Number(last?.lateByMinutes || 0) > 0;
    const lastState = last ? LAST_STATE[last.statusLabel.toLowerCase()] : undefined;

    return (
        <TechPage tab="home" testId="technician-rating">
            <TechBack to="/technician/dashboard" />
            <h1 className="tp-h1 tp-pj">{t("rating.title")}</h1>

            {loading ? (
                <p className="tp-empty" role="status">{t("common.loading")}</p>
            ) : (
                <>
                    <div className="tp-rate" data-testid="rating-average">
                        <b className="tp-pj">{averageRating.toFixed(1)}</b>
                        <TechStars value={averageRating} />
                        <span>
                            {reviews.length === 0
                                ? t("rating.none")
                                : reviews.length === 1
                                    ? t("rating.fromOne")
                                    : t("rating.from", { n: reviews.length })}
                        </span>
                    </div>

                    <h2 className="tp-h2 tp-pj">{t("rating.onTimeTitle")}</h2>
                    <div className="tp-time" data-testid="rating-on-time">
                        {performance.totalOrders === 0 ? (
                            <b>{t("rating.noJobs")}</b>
                        ) : (
                            <>
                                <b>{t("rating.onTimeLine", { a: performance.onTimeOrders, b: performance.totalOrders })}</b>
                                <div className="tp-split" aria-hidden="true">
                                    {performance.onTimeOrders > 0 ? <i style={{ flex: performance.onTimeOrders }} /> : null}
                                    {performance.lateOrders > 0 ? <i style={{ flex: performance.lateOrders, background: "#F04438" }} /> : null}
                                </div>
                                <div className="tp-key">
                                    <span>{t("rating.onTime")} · {performance.onTimeOrders}</span>
                                    <span>{t("rating.late")} · {performance.lateOrders}</span>
                                </div>
                            </>
                        )}
                        {last ? (
                            <div className="tp-last">
                                <span>{t("rating.lastJob")} <b>{techServiceName(lang, last.serviceType)}</b></span>
                                {lastLate ? (
                                    <span className="tp-state is-void">{t("rating.lateBy", { n: Number(last.lateByMinutes) })}</span>
                                ) : (
                                    <span className="tp-state is-off">{lastState ? t(lastState) : last.statusLabel}</span>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <h2 className="tp-h2 tp-pj">{t("rating.said")}</h2>
                    <div className="tp-list" data-testid="rating-reviews">
                        {reviews.length === 0 ? (
                            <p className="tp-empty">{t("rating.noReviews")}</p>
                        ) : (
                            reviews.map((review, index) => {
                                const stars = Number(review?.rating || 0);
                                const when = techDayLabel(lang, review?.created_at || review?.date);
                                return (
                                    <div key={review?.id ?? index} className="tp-review">
                                        <div className="tp-review-top">
                                            <b>{review?.reviewer_name || review?.name}</b>
                                            <TechStars value={stars} label={t("rating.stars", { n: stars })} />
                                        </div>
                                        {review?.comment ? <p>{review.comment}</p> : null}
                                        {when ? <small>{when}</small> : null}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </TechPage>
    );
};

export default TechnicianReviewsPage;
