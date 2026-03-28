"use client";

import { useEffect, useState } from "react";

export type MarketplaceRole = "employer" | "freelancer";

const STORAGE_KEY = "monadwork-role";
const SYNC_EVENT = "monadwork-role-sync";

export function useMarketplaceRole() {
  const [role, setRole] = useState<MarketplaceRole>("freelancer");

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "employer" || stored === "freelancer") {
      setRole(stored);
    }

    const handleSync = (e: any) => {
      const nextRole = e.detail || window.localStorage.getItem(STORAGE_KEY);
      if (nextRole === "employer" || nextRole === "freelancer") {
        setRole(nextRole);
      }
    };

    window.addEventListener(SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    
    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const updateRole = (nextRole: MarketplaceRole) => {
    setRole(nextRole);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextRole);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: nextRole }));
    }
  };

  return {
    role,
    setRole: updateRole,
    isEmployerMode: role === "employer",
    isFreelancerMode: role === "freelancer",
  };
}
