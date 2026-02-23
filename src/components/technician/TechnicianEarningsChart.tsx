import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface EarningsData {
    date: string;
    amount: number;
}

interface TechnicianEarningsChartProps {
    data: EarningsData[];
}

const TechnicianEarningsChart: React.FC<TechnicianEarningsChartProps & { showCard?: boolean }> = ({ data, showCard = true }) => {
    const ChartContent = (
        <div className={`w-full mt-4 ${showCard ? 'h-[300px]' : 'h-full'}`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#666' }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#666' }}
                        tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value) => [`₹${value}`, 'Earnings']}
                    />
                    <Bar
                        dataKey="amount"
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );

    if (!showCard) {
        return ChartContent;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl">Earnings Overview</CardTitle>
            </CardHeader>
            <CardContent>
                {ChartContent}
            </CardContent>
        </Card>
    );
};

export default TechnicianEarningsChart;
