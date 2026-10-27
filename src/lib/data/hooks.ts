"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { fb } from "@/lib/firebase/client";
import type {
  AppNotification,
  AuditLog,
  Purchase,
  Receipt,
  Reminder,
  VaultDocument,
} from "@/lib/types";

type OwnedCollection = "documents" | "reminders" | "receipts" | "purchases" | "notifications" | "auditLogs";

interface QuerySpec {
  filterField?: string;
  filterValue?: string | boolean;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  max?: number;
  enabled?: boolean;
}

export interface QueryResult<T> {
  items: T[];
  loading: boolean;
  error: unknown;
  retry: () => void;
}

export function useOwnedCollection<T>(name: OwnedCollection, spec: QuerySpec = {}): QueryResult<T> {
  const { user } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(user) && spec.enabled !== false);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const {
    filterField,
    filterValue,
    orderByField,
    orderDirection = "desc",
    max,
    enabled = true,
  } = spec;

  useEffect(() => {
    if (!user || !enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    const { db } = fb();
    const constraints: QueryConstraint[] = [where("ownerId", "==", user.uid)];
    if (filterField) constraints.push(where(filterField, "==", filterValue));
    if (orderByField) constraints.push(orderBy(orderByField, orderDirection));
    if (max) constraints.push(limitTo(max));

    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, name), ...constraints),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, name, filterField, filterValue, orderByField, orderDirection, max, enabled, nonce]);

  return { items, loading, error, retry: () => setNonce((value) => value + 1) };
}

export function useDocuments() {
  return useOwnedCollection<VaultDocument>("documents", { orderByField: "updatedAt", max: 500 });
}

export function useReceipts() {
  return useOwnedCollection<Receipt>("receipts", { orderByField: "purchaseDate", max: 500 });
}

export function usePurchases() {
  return useOwnedCollection<Purchase>("purchases", { orderByField: "purchaseDate", max: 2000 });
}

export function useScheduledReminders(max = 200) {
  return useOwnedCollection<Reminder>("reminders", {
    filterField: "status",
    filterValue: "scheduled",
    orderByField: "dueDate",
    orderDirection: "asc",
    max,
  });
}

export function useNotifications(max = 50) {
  return useOwnedCollection<AppNotification>("notifications", { orderByField: "createdAt", max });
}

export function useAuditLogs(max = 20) {
  return useOwnedCollection<AuditLog>("auditLogs", { orderByField: "createdAt", max });
}

export interface DocResult<T> {
  item: T | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

/** Subscribes to one owned document. Rules let the owner read a missing doc, so `item` is null when deleted. */
export function useOwnedDoc<T>(name: OwnedCollection, id: string | null): DocResult<T> {
  const { user } = useAuth();
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(user && id));
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user || !id) {
      setItem(null);
      setLoading(false);
      return;
    }
    const { db } = fb();
    setLoading(true);
    return onSnapshot(
      doc(db, name, id),
      (snapshot) => {
        setItem(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      },
    );
  }, [user, name, id, nonce]);

  return { item, loading, error, retry: () => setNonce((value) => value + 1) };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
