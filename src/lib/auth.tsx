"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { fb, isFirebaseConfigured } from "@/lib/firebase/client";
import { storedLanguage } from "@/lib/i18n";
import { MANAGED_MODULES, type Plan, type Profile } from "@/lib/types";

interface AuthValue {
  configured: boolean;
  /** True while Firebase is still resolving the cached session. */
  loading: boolean;
  profileLoading: boolean;
  user: User | null;
  profile: Profile | null;
  plan: Plan;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  sendPhoneCode: (phone: string, container: HTMLElement) => Promise<void>;
  confirmPhoneCode: (code: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function defaultProfile(user: User): DocumentData {
  return {
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? null,
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    country: "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    language: storedLanguage(),
    theme: "system",
    notificationPrefs: {
      push: true,
      email: false,
      inApp: true,
      quietStart: 22,
      quietEnd: 7,
      reminderHour: 9,
    },
    modules: [...MANAGED_MODULES],
    onboardingCompleted: false,
    aiAnalysisEnabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function requireCredentials() {
  if (!isFirebaseConfigured) throw new Error("firebase-not-configured");
}

let phoneConfirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth } = fb();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const { db } = fb();
    const profileRef = doc(db, "profiles", user.uid);
    let active = true;
    let creating = false;
    setProfile(null);
    setProfileLoading(true);

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          setProfile(snapshot.data() as Profile);
          setProfileLoading(false);
          return;
        }
        if (creating) return;
        creating = true;
        setDoc(profileRef, defaultProfile(user))
          .catch(() => {
            // Permission or network failure: the UI shows a retryable error instead of a blank shell.
            if (active) setProfile(null);
          })
          .finally(() => {
            creating = false;
            if (active) setProfileLoading(false);
          });
      },
      () => {
        if (!active) return;
        setProfileLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPlan("free");
      return;
    }
    const { db } = fb();
    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const value = snapshot.data()?.plan;
        setPlan(value === "pro" || value === "business" ? value : "free");
      },
      () => setPlan("free"),
    );
  }, [user]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    requireCredentials();
    await signInWithEmailAndPassword(fb().auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string) => {
    requireCredentials();
    const { auth, db } = fb();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const trimmed = name.trim();
    if (trimmed) {
      await updateAuthProfile(credential.user, { displayName: trimmed });
      // The profile document may already exist (created on the auth event) without a name.
      const profileRef = doc(db, "profiles", credential.user.uid);
      const snapshot = await getDoc(profileRef).catch(() => null);
      if (snapshot?.exists() && !snapshot.data().displayName) {
        await setDoc(profileRef, {
          ...snapshot.data(),
          displayName: trimmed,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await sendEmailVerification(credential.user).catch(() => {
      // The account still works; the verify banner offers a resend.
    });
  }, []);

  const signInGoogle = useCallback(async () => {
    requireCredentials();
    await signInWithPopup(fb().auth, new GoogleAuthProvider());
  }, []);

  const sendPhoneCode = useCallback(async (phone: string, container: HTMLElement) => {
    requireCredentials();
    const { auth } = fb();
    if (recaptcha) {
      recaptcha.clear();
      recaptcha = null;
    }
    recaptcha = new RecaptchaVerifier(auth, container, { size: "invisible" });
    try {
      phoneConfirmation = await signInWithPhoneNumber(auth, phone.trim(), recaptcha);
    } catch (error) {
      recaptcha.clear();
      recaptcha = null;
      throw error;
    }
  }, []);

  const confirmPhoneCode = useCallback(async (code: string) => {
    if (!phoneConfirmation) throw new Error("auth/no-phone-request");
    await phoneConfirmation.confirm(code.trim());
    phoneConfirmation = null;
    recaptcha = null;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    requireCredentials();
    await sendPasswordResetEmail(fb().auth, email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    requireCredentials();
    const current = fb().auth.currentUser;
    if (current) await sendEmailVerification(current);
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      requireCredentials();
      if (!user) throw new Error("auth/no-user");
      if (!profile) throw new Error("profile-not-loaded");
      const { db } = fb();
      const ref = doc(db, "profiles", user.uid);
      // Rules validate the whole profile shape on every write, so send the full record.
      const next: Record<string, unknown> = {
        ...profile,
        ...patch,
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, next);
    },
    [profile, user],
  );

  const signOutUser = useCallback(async () => {
    requireCredentials();
    await signOut(fb().auth);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      configured: isFirebaseConfigured,
      loading,
      profileLoading,
      user,
      profile,
      plan,
      signInEmail,
      signUpEmail,
      signInGoogle,
      sendPhoneCode,
      confirmPhoneCode,
      resetPassword,
      resendVerification,
      saveProfile,
      signOutUser,
    }),
    [
      loading,
      profileLoading,
      user,
      profile,
      plan,
      signInEmail,
      signUpEmail,
      signInGoogle,
      sendPhoneCode,
      confirmPhoneCode,
      resetPassword,
      resendVerification,
      saveProfile,
      signOutUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
