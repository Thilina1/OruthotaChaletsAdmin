'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface InventoryChartsProps {
    pieData: { name: string; value: number; fill: string }[];
    barData: { name: string; received: number; issued: number; damaged: number }[];
    periodLabel: string;
}

export default function InventoryCharts({ pieData, barData, periodLabel }: InventoryChartsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie chart — transaction type distribution */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Transaction Type Distribution</CardTitle>
                    <CardDescription className="text-xs">Count of transactions by type ({periodLabel})</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{
                        Received: { label: 'Received', color: '#22c55e' },
                        Issued: { label: 'Issued', color: '#3b82f6' },
                        Damaged: { label: 'Damaged', color: '#ef4444' },
                        'Audit Adj': { label: 'Audit Adj', color: '#f59e0b' },
                    }} className="h-[220px]">
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name"
                                cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                                paddingAngle={3} label={({ name, percent }) =>
                                    percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                                }>
                                {pieData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                                ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Bar chart — top items by quantity */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Top Items by Quantity</CardTitle>
                    <CardDescription className="text-xs">Received vs Issued vs Damaged ({periodLabel})</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{
                        received: { label: 'Received', color: '#22c55e' },
                        issued: { label: 'Issued', color: '#3b82f6' },
                        damaged: { label: 'Damaged', color: '#ef4444' },
                    }} className="h-[220px]">
                        <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="received" fill="#22c55e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="issued" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="damaged" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
