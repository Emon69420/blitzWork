"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/Shell";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { parseSkills, type JobApplication } from "@/lib/marketplace";
import { supabase } from "@/lib/supabase";

const accents = [
  "bg-[rgba(217,200,255,0.55)]",
  "bg-[rgba(255,217,201,0.7)]",
  "bg-[rgba(205,235,220,0.8)]",
  "bg-[rgba(219,233,255,0.82)]",
];

export default function ProfilePage() {
  const { address, user, profile, loading, error, configured } = useWalletProfile();
  const [draft, setDraft] = useState({
    display_name: "",
    username: "",
    bio: "",
    services_offered: "",
    country: "",
    skills: "",
    hourly_rate_display: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [applicationCount, setApplicationCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setDraft({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      services_offered: profile.services_offered ?? "",
      country: profile.country ?? "",
      skills: (profile.skills ?? []).join(", "),
      hourly_rate_display: profile.hourly_rate_display?.toString() ?? "",
    });
  }, [profile]);

  useEffect(() => {
    async function loadApplicationCount() {
      if (!supabase || !user) return;
      const { data } = await supabase.from("job_applications").select("id").eq("freelancer_user_id", user.id);
      setApplicationCount(((data ?? []) as JobApplication[]).length);
    }

    void loadApplicationCount();
  }, [user]);

  const skills = parseSkills(draft.skills);

  const profileCompleteness = useMemo(() => {
    const checks = [
      draft.display_name.trim(),
      draft.bio.trim(),
      draft.services_offered.trim(),
      draft.skills.trim(),
      draft.country.trim(),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [draft]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;

    try {
      setSaving(true);
      setMessage("");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: draft.display_name || null,
          username: draft.username || null,
          bio: draft.bio || null,
          services_offered: draft.services_offered || null,
          country: draft.country || null,
          skills,
          hourly_rate_display: draft.hourly_rate_display ? Number(draft.hourly_rate_display) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      setMessage("Profile saved. Employers will now see the updated card in your applications.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile Atelier" subtitle="Craft your on-chain identity and build trust with prospective employers.">
      {!configured && (
        <div className="card-standard mb-6 border-red-900/50 bg-red-900/10 text-red-400">
          Supabase configuration missing. Check your environment variables.
        </div>
      )}

      <div className="grid gap-12 xl:grid-cols-[0.9fr_1.1fr] row-equal-height">
        {/* Preview Section */}
        <section className="card-standard !p-0 overflow-hidden border-[var(--border-dim)] bg-[var(--bg-secondary)]">
          <div className="relative bg-[#000] p-10 border-b border-[var(--border-dim)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-glow)] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 opacity-20" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-[var(--bg-tertiary)] border-2 border-[var(--accent-primary)] text-4xl font-black text-white shadow-[0_0_40px_var(--accent-glow)]">
                {(draft.display_name || "MW").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="badge badge-accent mb-3">Freelancer Identity</div>
                <h2 className="text-4xl font-black text-white mb-2 leading-tight">{draft.display_name || "New Artisan"}</h2>
                <div className="text-sm font-mono text-[var(--accent-primary)] opacity-80 mb-4">{draft.username ? `@${draft.username}` : "no-handle-set"}</div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <span>{draft.country || "Global"}</span>
                  <span className="h-1 w-1 rounded-full bg-[var(--text-muted)]" />
                  <span>{draft.hourly_rate_display || "0"} MON / hr</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-tertiary)] p-5 rounded-2xl border border-[var(--border-dim)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Wallet Node</div>
                <div className="font-mono text-xs text-white truncate">{address || "Disconnected"}</div>
              </div>
              <div className="bg-[var(--bg-tertiary)] p-5 rounded-2xl border border-[var(--border-dim)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Applications</div>
                <div className="text-2xl font-black text-white">{applicationCount}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Professional Bio</div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-6 rounded-2xl border border-[var(--border-dim)]">
                {draft.bio || "Describe your expertise and communication style..."}
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Services Architecture</div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-6 rounded-2xl border border-[var(--border-dim)]">
                {draft.services_offered || "Detail the solutions you deliver..."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Technical Stack</div>
              <div className="flex flex-wrap gap-2">
                {skills.length ? (
                  skills.map((skill) => (
                    <span key={skill} className="badge bg-[var(--bg-tertiary)] border border-[var(--border-dim)] text-white px-4 py-2">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[var(--text-muted)] italic">No skills listed yet.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <form onSubmit={saveProfile} className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-6 mb-8 flex items-center justify-between">
            <div>
              <div className="badge badge-accent mb-2">Configuration</div>
              <h3 className="text-2xl">Modify Profile</h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Trust Score</div>
              <div className="text-3xl font-black text-[var(--accent-primary)]">{profileCompleteness}%</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Legal Label</label>
              <input
                value={draft.display_name}
                onChange={(e) => setDraft((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="Ex: Alex Rivera"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Handle</label>
              <input
                value={draft.username}
                onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
                placeholder="Ex: alex_dev"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Jurisdiction</label>
              <input
                value={draft.country}
                onChange={(e) => setDraft((p) => ({ ...p, country: e.target.value }))}
                placeholder="Ex: USA"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Target Rate (MON)</label>
              <input
                value={draft.hourly_rate_display}
                onChange={(e) => setDraft((p) => ({ ...p, hourly_rate_display: e.target.value }))}
                type="number"
                placeholder="40"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all"
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Artisan Bio</label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
              rows={4}
              placeholder="Tell your story..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all resize-none"
            />
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Offerings Catalog</label>
            <textarea
              value={draft.services_offered}
              onChange={(e) => setDraft((p) => ({ ...p, services_offered: e.target.value }))}
              rows={3}
              placeholder="List your core services..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all resize-none"
            />
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">Resource Tags (comma separated)</label>
            <input
              value={draft.skills}
              onChange={(e) => setDraft((p) => ({ ...p, skills: e.target.value }))}
              placeholder="solidity, physics, ui/ux"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none text-sm transition-all"
            />
          </div>

          <div className="mt-12 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              {message && (
                <div className={`text-xs font-bold uppercase tracking-widest transition-all ${message.includes('saved') ? 'text-green-400' : 'text-[var(--accent-primary)]'}`}>
                  {message}
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={!configured || !user || saving || loading} 
              className="btn-primary w-full md:w-64 h-14 text-base font-black shadow-[0_0_30px_rgba(255,77,41,0.2)]"
            >
              {saving ? "Encrypting Changes..." : "Commit Profile"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
