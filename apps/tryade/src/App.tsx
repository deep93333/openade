import { useCallback, useState } from "react";

const ORIGIN =
  typeof window !== "undefined" && window.location.origin !== "null"
    ? window.location.origin
    : "https://tryade.dev";

const INSTALL_LINE = `curl -fsSL ${ORIGIN}/i | bash`;

export function App() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_LINE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      //
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -20%, rgb(16 185 129 / 0.25), transparent),
            radial-gradient(ellipse 60% 40% at 100% 50%, rgb(59 130 246 / 0.12), transparent)`,
        }}
      />

      <header className="relative border-b border-white/5 bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-white">
            tryade<span className="text-emerald-400">.dev</span>
          </span>
          <a
            className="text-sm font-medium text-slate-400 transition hover:text-emerald-400"
            href="https://github.com/deep93333/openade"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 pb-24 pt-16 md:pt-24">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400/90">
          Agent-first IDE
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Install AgentIDE in one command
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
          tryade.dev hosts a short install bootstrap and the full setup script for{" "}
          <a
            className="text-slate-300 underline decoration-white/20 underline-offset-4 transition hover:text-emerald-400 hover:decoration-emerald-400/50"
            href="https://github.com/deep93333/openade"
            target="_blank"
            rel="noreferrer"
          >
            AgentIDE
          </a>
          — clone the repo, install Bun if needed, and start the dev stack.
        </p>

        <div className="mt-10 rounded-xl border border-white/10 bg-slate-900/50 p-1 shadow-2xl shadow-emerald-950/20 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[#0c1222] px-4 py-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-emerald-100/95 md:text-[0.95rem]">
              {INSTALL_LINE}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Advanced: full script at{" "}
          <a className="text-slate-400 hover:text-emerald-400" href={`${ORIGIN}/install.sh`}>
            /install.sh
          </a>
          . Fork? Set <code className="font-mono text-slate-400">AGENTIDE_REPO</code> before running
          the curl line.
        </p>

        <section className="mt-20 border-t border-white/5 pt-16">
          <h2 className="text-xl font-semibold text-white">What you need</h2>
          <ul className="mt-6 space-y-3 text-slate-400">
            <li className="flex gap-3">
              <span className="text-emerald-500">—</span>
              Git
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-500">—</span>
              Network access (script can install Bun automatically)
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-500">—</span>
              Claude Code configured for AgentIDE after install
            </li>
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-white">Deploy this site</h2>
          <p className="mt-4 text-slate-400">
            Build output is static (
            <code className="font-mono text-slate-500">apps/tryade/dist</code>
            ). Point <strong className="font-medium text-slate-300">tryade.dev</strong> at your host
            (Vercel, Cloudflare Pages, Netlify). Set project root to{" "}
            <code className="font-mono text-slate-500">apps/tryade</code> or deploy only{" "}
            <code className="font-mono text-slate-500">dist</code> after{" "}
            <code className="font-mono text-slate-500">bun run build</code>.
          </p>
        </section>
      </main>

      <footer className="relative border-t border-white/5 py-8 text-center text-sm text-slate-600">
        AgentIDE is open source. tryade.dev is a convenience mirror for install scripts.
      </footer>
    </div>
  );
}
