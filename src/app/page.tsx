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
    if (!user) {
      router.replace("/welcome/");
      return;
    }
    if (profile && !profile.onboardingCompleted) {
      router.replace("/onboarding/");
      return;
    }
    if (profile) router.replace("/home/");
  }, [configured, loading, profileLoading, user, profile, router]);

  if (!configured) return <ConfigMissing />;
  return <Splash />;
}
