
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Dashboard', href: '/', icon: '📊' },
        { name: 'Claims Audit', href: '/claims', icon: '📋' },
        { name: 'DRG Review', href: '/drg-review', icon: '🏥' },
        { name: 'Med Necessity', href: '/med-necessity', icon: '🔍' },
        { name: 'Readmissions', href: '/readmission-review', icon: '🔄' },
        { name: 'Settings', href: '/settings', icon: '⚙️' },
    ];

    return (
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col">
            {/* Brand */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center shadow-md shadow-violet-600/30">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" fillOpacity="0.9"/>
                            <path d="M8 5L11 6.75V10.25L8 12L5 10.25V6.75L8 5Z" fill="white" fillOpacity="0.4"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">Autonomize AI</h1>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wider mt-0.5">FWA Sentinel</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 pt-4 space-y-0.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <span className={`text-base ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>{item.icon}</span>
                            <span>{item.name}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">System Status</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20"></span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Agent Active</p>
                    <p className="text-xs text-slate-400 mt-1">Monitoring live claims</p>
                </div>
                <p className="text-center text-[10px] text-slate-300 font-medium mt-3 uppercase tracking-widest">Powered by Autonomize AI</p>
            </div>
        </aside>
    );
}
