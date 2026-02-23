
import React from "react";
import RevenueChart from "./RevenueChart";
import ReviewsList from "./ReviewsList";

interface OverviewTabProps {
  revenueData: Array<{ date: string; amount: number }>;
  reviews: Array<{
    name: string;
    rating: number;
    comment: string;
    date: string;
  }>;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ revenueData, reviews }) => {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <RevenueChart data={revenueData} />
      <ReviewsList reviews={reviews} />
    </div>
  );
};

export default OverviewTab;
