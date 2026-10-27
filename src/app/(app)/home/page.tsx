"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc]">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-zinc-900 flex">
      {/* Sidebar - Notion Style */}
      <div className="w-[240px] border-r border-zinc-200 bg-white p-4 hidden md:flex flex-col">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs">L</div>
          <span className="font-semibold text-[14px]">LifeOS</span>
        </div>
        
        <div className="mt-8 space-y-1">
          <div className="px-2 text-[11px] text-zinc-400 font-medium uppercase tracking-widest">Workspace</div>
          <div className="mt-2 space-y-1">
            <div className="px-2 py-2 rounded-lg bg-zinc-100 text-sm font-medium">🏠 Home</div>
            <div className="px-2 py-2 rounded-lg hover:bg-zinc-50 text-sm text-zinc-600">✓ Tasks</div>
            <div className="px-2 py-2 rounded-lg hover:bg-zinc-50 text-sm text-zinc-600">🔥 Habits</div>
            <div className="px-2 py-2 rounded-lg hover:bg-zinc-50 text-sm text-zinc-600">🎯 Goals</div>
          </div>
        </div>

        <div className="mt-auto px-2 py-3 border-t border-zinc-100">
          <div className="text-xs text-zinc-500 truncate">{user?.email || "oot loot"}</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1">
        <div className="max-w-[900px] mx-auto px-6 md:px-10 py-10 md:py-14">
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.03em]">Good morning, {user?.displayName?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-zinc-500 mt-2 text-[15px]">Here's what's happening today. Stay focused.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[
              { k: "Tasks", v: "3/5", s: "Today", w: "60%" },
              { k: "Habits", v: "5 days", s: "Streak", w: "100%" },
              { k: "Goals", v: "68%", s: "Q1 Progress", w: "68%" },
            ].map((i) => (
              <div key={i.k} className="bg-white border border-zinc-200 rounded-[16px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[11px] tracking-widest uppercase text-zinc-400 font-medium">{i.k}</div>
                <div className="text-2xl font-semibold mt-2">{i.v}</div>
                <div className="text-xs text-zinc-500 mt-1">{i.s}</div>
                <div className="mt-4 h-1.5 bg-zinc-100 rounded-full"><div style={{ width: i.w }} className="h-1.5 bg-black rounded-full"></div></div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-white border border-zinc-200 rounded-[20px] p-2">
            <div className="px-4 py-3 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Today's Focus</h2>
              <button className="text-xs px-3 py-1.5 bg-black text-white rounded-full">+ New</button>
            </div>
            <div className="space-y-1 p-1">
              {["Design new landing page", "Fix loading issue", "Update Firestore rules"].map((t, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-[12px] hover:bg-[#fafafa] border border-transparent hover:border-zinc-100 transition group">
                  <div className="w-5 h-5 rounded-full border border-zinc-300 group-hover:border-black flex items-center justify-center transition">
                    <div className="w-2 h-2 bg-black rounded-full opacity-0 group-hover:opacity-100 transition"></div>
                  </div>
                  <span className="text-sm flex-1">{t}</span>
                  <span className="text-xs text-zinc-400">Today</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/welcome" className="text-xs text-zinc-400 hover:text-zinc-600">View welcome page →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
