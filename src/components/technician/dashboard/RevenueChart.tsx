
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface RevenueData {
  date: string;
  amount: number;
}

interface RevenueChartProps {
  data: RevenueData[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ChartContainer
          className="h-[300px]"
          config={{
            primary: {
              theme: {
                light: "var(--primary)",
                dark: "var(--primary)",
              },
            },
          }}
        >
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" />
            <YAxis />
            <ChartTooltip />
            <Area 
              type="monotone" 
              dataKey="amount" 
              stroke="var(--primary)" 
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
