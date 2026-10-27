"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ConfigMissing, Splash } from "@/components/shell";

export default function IndexPage() {
  const { configured, loading, user, profile, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!configured || loading || profileLoading) return;
    if (!user) { router.replace("/welcome"); return; }
    if (profile && !profile.onboardingCompleted) { router.replace("/onboarding"); return; }
    if (profile) router.replace("/home");
  }, [configured, loading, profileLoading, user, profile, router]);

  if (!configured) return <ConfigMissing />;
  
  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fcfcfc'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40, height:40, background:'black', color:'white', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>L</div>
        <p>LifeOS Loading...</p>
      </div>
    </div>
  );
}
