"use client";

import Link from "next/link";
import { useAccount, useConnect } from "wagmi";
import { metaMask } from "wagmi/connectors";

const problems = [
  {
    problem: "Payment Disputes",
    solution: "Smart-contract escrow keeps funds locked on-chain until rules or arbitration release them.",
  },
  {
    problem: "Credential Fraud",
    solution: "Authorized issuers can publish verifiable freelancer credentials directly on-chain.",
  },
  {
    problem: "Delayed Payments",
    solution: "Streaming payments let MON accrue every second instead of waiting for invoicing cycles.",
  },
];

const monadReasons = [
  { feature: "10,000 TPS", benefit: "Many jobs can stream and settle at once without congestion." },
  { feature: "0.4s Blocks", benefit: "The live earnings counter feels real instead of lagging behind." },
  { feature: "Parallel Execution", benefit: "Escrow and credentials can move without turning into a queue." },
  { feature: "Near-Zero Gas", benefit: "Micro-withdrawals stay viable even for tiny balances." },
];

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  return (
    <main className="min-h-screen bg-gradient-subtle overflow-x-hidden">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 md:px-12">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)] font-black text-black text-xl shadow-[0_0_20px_var(--accent-glow)]">
            M
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">MonadWork</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-primary)] opacity-80">Hyper-Scale Freelance</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block badge border border-[var(--border-dim)] px-4 py-2 font-mono lowercase">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <Link href="/employer" className="btn-primary px-6 h-11">
                Launch Studio
              </Link>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: metaMask() })}
              className="btn-primary px-8 h-11"
            >
              Connect App
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-32 text-center">
        <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-[var(--border-active)] bg-[var(--accent-glow)] px-6 py-2 text-sm font-bold text-[var(--accent-primary)] shadow-[0_0_40px_rgba(255,77,41,0.05)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          Monad Testnet Native
        </div>

        <h1 className="max-w-4xl text-5xl font-black leading-[1.1] tracking-tight md:text-8xl mb-10 text-white">
          The future of work is <span className="text-[var(--accent-primary)]">Streamed.</span>
        </h1>

        <p className="max-w-2xl text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed mb-12">
          MonadWork combines secure on-chain escrow, micro-second streaming payments, and decentralized jury arbitration into one unified engine.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          {isConnected ? (
            <>
              <Link href="/employer" className="btn-primary w-full sm:w-auto px-12 h-14 text-lg">
                For Employers
              </Link>
              <Link href="/freelancer" className="btn-secondary w-full sm:w-auto px-12 h-14 text-lg">
                For Freelancers
              </Link>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: metaMask() })}
              className="btn-primary px-16 h-14 text-lg"
            >
              Get Started with Metamask
            </button>
          )}
        </div>
      </section>

      {/* Problem/Solution Grid */}
      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-32 md:grid-cols-3">
        {problems.map((item) => (
          <div key={item.problem} className="card-standard !p-10 group cursor-default">
            <div className="mb-6 h-1 w-12 bg-white/10 group-hover:bg-[var(--accent-primary)] transition-colors" />
            <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-primary)]">Scenario</div>
            <h2 className="mb-4 text-2xl font-bold text-white">{item.problem}</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">{item.solution}</p>
          </div>
        ))}
      </section>

      {/* Why Monad Section */}
      <section className="mx-auto max-w-7xl px-6 pb-32">
        <div className="card-standard !p-12 md:!p-20 bg-black/40 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--accent-glow)] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 opacity-20" />
          
          <div className="relative z-10">
            <div className="mb-12 text-center md:text-left">
              <div className="badge badge-accent mb-4">Infrastructure</div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Powered by Monad</h2>
              <p className="max-w-2xl text-[var(--text-secondary)]">
                Scaling trust requires high-frequency execution. Monad's parallel architecture handles thousands of streaming jobs without friction.
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {monadReasons.map((item) => (
                <div key={item.feature} className="p-6 rounded-2xl border border-[var(--border-dim)] bg-black/20">
                  <div className="mb-2 text-xl font-bold text-white">{item.feature}</div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-dim)] py-12 px-6 text-center">
        <div className="text-[var(--text-muted)] text-sm font-medium">
          © 2026 MonadWork. Built on Monad Testnet for the Global Blitz.
        </div>
      </footer>
    </main>
  );
}
