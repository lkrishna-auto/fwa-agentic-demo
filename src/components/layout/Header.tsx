
export default function Header({ title }: { title: string }) {
    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{title}</h2>
            </div>
            <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer transition-colors">
                    <span>🔔</span>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex items-center space-x-3">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-slate-700">John Investigator</span>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Senior Auditor</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20 flex items-center justify-center text-white text-sm font-bold">
                        JI
                    </div>
                </div>
            </div>
        </header>
    );
}
