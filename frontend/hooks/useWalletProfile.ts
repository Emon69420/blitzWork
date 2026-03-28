"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { AppUser, Profile } from "@/lib/marketplace";
import { ensureWalletUser } from "@/lib/wallet-user";
import { isSupabaseConfigured } from "@/lib/supabase";

export function useWalletProfile() {
  const { address, isConnected } = useAccount();
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!address || !isConnected || !isSupabaseConfigured) {
        setUser(null);
        setProfile(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await ensureWalletUser(address);
        if (!cancelled) {
          setUser(result.user);
          setProfile(result.profile);
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : "Failed to load wallet profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  return { address, user, profile, loading, error, configured: isSupabaseConfigured };
}
