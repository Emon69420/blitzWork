import type { Profile, AppUser } from "@/lib/marketplace";
import { normalizeWalletAddress } from "@/lib/marketplace";
import { supabase } from "@/lib/supabase";

export async function ensureWalletUser(walletAddress: string): Promise<{
  user: AppUser;
  profile: Profile;
}> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const wallet = normalizeWalletAddress(walletAddress);

  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert(
      {
        wallet_address: wallet,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "wallet_address",
      }
    )
    .select("*")
    .single<AppUser>();

  if (userError || !user) {
    throw new Error(userError?.message || "Failed to bootstrap wallet user");
  }

  const defaultDisplayName = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: defaultDisplayName,
        is_employer: true,
        is_freelancer: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select("*")
    .single<Profile>();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Failed to bootstrap wallet profile");
  }

  return { user, profile };
}
