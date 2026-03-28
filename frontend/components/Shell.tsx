"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useMarketplaceRole } from "@/hooks/useMarketplaceRole";

const navItems = [
  { href: "/employer", label: "Employer" },
  { href: "/freelancer", label: "Freelancer" },
  { href: "/disputes", label: "Disputes" },
  { href: "/profile", label: "Edit Profile" },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { role, setRole } = useMarketplaceRole();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full border-b-[1.5px] border-[var(--border-dim)] bg-[var(--bg-primary)] p-6 lg:fixed lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r-[1.5px]">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] font-bold text-white shadow-[0_0_20px_var(--accent-glow)]">
              MW
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">MonadWork</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Escrow Studio</div>
            </div>
          </Link>

          <div className="mt-12 hidden lg:block">
            <div className="mb-8 rounded-xl bg-[var(--bg-secondary)] p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setRole("employer")}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    role === "employer" 
                      ? "bg-[var(--bg-tertiary)] text-[var(--accent-primary)] shadow-sm" 
                      : "text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  Employer
                </button>
                <button
                  onClick={() => setRole("freelancer")}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    role === "freelancer" 
                      ? "bg-[var(--bg-tertiary)] text-[var(--accent-primary)] shadow-sm" 
                      : "text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  Freelancer
                </button>
              </div>
            </div>

            <nav className="space-y-1">
              {isConnected && (
                <Link
                  href={`/profile/${address}`}
                  className={`sidebar-nav-item ${pathname === `/profile/${address}` ? "active" : ""}`}
                >
                  <span className="text-[var(--accent-primary)]">My Public Profile</span>
                </Link>
              )}
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item ${active ? "active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto hidden lg:block">
            <div className="card-standard !p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Network</div>
              {isConnected ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="font-mono text-xs text-[var(--text-secondary)]">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => connect({ connector: metaMask() })}
                  className="btn-primary mt-4 h-10 w-full text-xs"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:pl-[280px]">
          <div className="section-padding">
            <header className="mb-12 max-w-4xl">
              <span className="badge mb-4">Workspace</span>
              <h1 className="mb-4">{title}</h1>
              {subtitle && <p className="text-xl text-[var(--text-secondary)]">{subtitle}</p>}
            </header>

            <div className="min-h-[500px]">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <div className="mt-4 flex flex-wrap gap-2 px-6 pb-8 lg:hidden">
        {navItems.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

