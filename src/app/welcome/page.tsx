"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ConfigMissing, Splash } from "@/components/shell";

export default function WelcomePage() {
  const { configured, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && user) router.replace("/");
  }, [configured, loading, user, router]);

  if (!configured) return <ConfigMissing />;
  if (loading || user) return <Splash />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-zinc-900 selection:bg-black selection:text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-6 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-[10px] flex items-center justify-center text-white font-bold text-[13px]">L</div>
          <span className="font-semibold tracking-tight text-[15px]">LifeOS</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-full hover:bg-zinc-100 transition">Log in</Link>
          <Link href="/signup" className="px-5 py-2.5 text-sm font-medium rounded-full bg-black text-white hover:bg-zinc-800 transition">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-[1200px] mx-auto px-6 md:px-10 pt-24 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-zinc-200 text-xs text-zinc-600 shadow-sm mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Notion + Linear inspired
          </div>
          <h1 className="text-[44px] md:text-[72px] font-bold tracking-[-0.04em] leading-[0.9]">Your entire life,<br/><span className="text-zinc-400 font-medium tracking-[-0.03em]">perfectly organized.</span></h1>
          <p className="mt-6 text-[17px] leading-7 text-zinc-500 max-w-xl mx-auto">Tasks, habits, goals and notes. One minimal workspace built for focus. No clutter, just clarity.</p>
          
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="px-7 py-3.5 rounded-full bg-black text-white text-sm font-medium shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:bg-zinc-800 transition">Start for free — it takes 30s</Link>
            <Link href="/login" className="px-7 py-3.5 rounded-full bg-white border border-zinc-200 text-sm font-medium hover:bg-zinc-50 transition">View demo</Link>
          </div>

          <p className="mt-4 text-xs text-zinc-400">No credit card required • Cancel anytime</p>
        </div>

        {/* Mock Dashboard - Clean Card */}
        <div className="mt-20 rounded-[28px] border border-zinc-200 bg-white p-3 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.25)]">
          <div className="rounded-[18px] border border-zinc-100 bg-[#fafafa] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-zinc-100">
              <div className="flex items-center gap-2"><div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div><div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div><div className="w-3 h-3 rounded-full bg-[#27c93f]"></div></div><span className="ml-3 text-xs text-zinc-400">LifeOS — Today</span></div>
              <div className="text-xs text-zinc-400">100% focused</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
              {[
                {t:"Tasks", d:"3 done today", c:"bg-white"},
                {t:"Habits", d:"5 day streak", c:"bg-white"},
                {t:"Goals", d:"Q1 on track", c:"bg-white"},
              ].map((i)=>(
                <div key={i.t} className={`${i.c} rounded-xl border border-zinc-200 p-4`}>
                  <div className="text-sm font-semibold">{i.t}</div>
                  <div className="text-xs text-zinc-500 mt-1">{i.d}</div>
                  <div className="mt-4 h-2 bg-zinc-100 rounded-full"><div className="h-2 w-2/3 bg-black rounded-full"></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-zinc-400">Loved by minimalists • Built with Next.js & Firebase</div>
      </main>
    </div>
  );
}
