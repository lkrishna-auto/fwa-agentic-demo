
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
        { name: 'Reports', href: '/reports', icon: '📈' },
        { name: 'Settings', href: '/settings', icon: '⚙️' },
    ];

    return (
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col">
            <div className="p-6">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                        F
                    </div>
                    <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                        FWA Sentinel
                    </h1>
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                ? 'bg-slate-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <span className={`text-lg ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`}>{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Status</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20"></span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">Agent Active</p>
                    <p className="text-xs text-slate-400 mt-1">Monitoring live claims</p>
                </div>
            </div>
        </aside>
    );
}
