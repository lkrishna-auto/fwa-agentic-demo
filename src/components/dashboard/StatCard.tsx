
import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number;
        direction: 'up' | 'down';
    };
    icon: string;
    colorClass?: string;
    delay?: number;
}

export default function StatCard({ title, value, trend, icon, colorClass = "bg-white", delay = 0 }: StatCardProps) {
    return (
        <div
            className={`p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_12px_-4px_rgba(6,24,44,0.05)] hover:shadow-[0_4px_20px_-4px_rgba(6,24,44,0.1)] transition-all duration-300 group`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex justify-between items-start mb-5">
                <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight group-hover:scale-[1.02] transition-transform origin-left">{value}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300">
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="flex items-center text-sm">
                    <span
                        className={`font-semibold flex items-center px-2 py-0.5 rounded-full text-xs ${trend.direction === 'up'
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-rose-700 bg-rose-50'
                            }`}
                    >
                        {trend.direction === 'up' ? '↗' : '↘'} {trend.value}%
                    </span>
                    <span className="text-slate-400 ml-2 text-xs">vs last month</span>
                </div>
            )}
        </div>
    );
}
