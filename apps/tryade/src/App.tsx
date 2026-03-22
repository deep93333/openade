import { useCallback, useState } from "react";

const ORIGIN =
  typeof window !== "undefined" && window.location.origin !== "null"
    ? window.location.origin
    : "https://tryade.dev";

const CLI_LINE = "npx --yes @openade/cli";
const SHELL_LINE = `curl -fsSL ${ORIGIN}/install.sh | bash`;

export function App() {
  const [copied, setCopied] = useState<"cli" | "shell" | null>(null);

  const copyCli = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CLI_LINE);
      setCopied("cli");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      //
    }
  }, []);

  const copyShell = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SHELL_LINE);
      setCopied("shell");
      setTimeout(() => setCopied(null), 2000);
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
          Install Openade in one command
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
          Use the <strong className="font-medium text-slate-300">npm CLI</strong> (needs Node 20+
          and Git). It clones{" "}
          <a
            className="text-slate-300 underline decoration-white/20 underline-offset-4 transition hover:text-emerald-400 hover:decoration-emerald-400/50"
            href="https://github.com/deep93333/openade"
            target="_blank"
            rel="noreferrer"
          >
            Openade
          </a>
          , installs Bun if missing, runs{" "}
          <code className="font-mono text-slate-500">bun install</code>, then{" "}
          <code className="font-mono text-slate-500">bun run dev</code>.
        </p>

        <p className="mt-3 text-sm text-slate-500">
          Publish <code className="font-mono text-slate-600">@openade/cli</code> to npm first;
          until then run from a clone:{" "}
          <code className="font-mono text-slate-600">node packages/cli/bin/openade.cjs</code>
        </p>

        <div className="mt-10 rounded-xl border border-white/10 bg-slate-900/50 p-1 shadow-2xl shadow-emerald-950/20 backdrop-blur-sm">
          <p className="px-3 pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Recommended
          </p>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[#0c1222] px-4 py-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-emerald-100/95 md:text-[0.95rem]">
              {CLI_LINE}
            </code>
            <button
              type="button"
              onClick={copyCli}
              className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
              {copied === "cli" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-sm font-medium text-slate-500">Global install</p>
        <code className="mt-1 block font-mono text-sm text-slate-400">
          npm install -g @openade/cli && openade
        </code>

        <p className="mt-8 text-sm font-medium text-slate-500">Shell only (no npm)</p>
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-white/5 bg-slate-900/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-400 sm:text-sm">
            {SHELL_LINE}
          </code>
          <button
            type="button"
            onClick={copyShell}
            className="shrink-0 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 hover:bg-white/10"
          >
            {copied === "shell" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Shortcut <code className="font-mono">curl …/i | bash</code> tries{" "}
          <code className="font-mono">npx</code> first, then falls back to{" "}
          <code className="font-mono">install.sh</code>.
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Fork? Set <code className="font-mono text-slate-400">OPENADE_REPO</code> (or legacy{" "}
          <code className="font-mono text-slate-400">AGENTIDE_REPO</code>) in your environment
          before running the CLI or curl line.
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
              Node.js 20+ on PATH (for <code className="font-mono text-slate-500">npx</code> and
              Vite)
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-500">—</span>
              Network (CLI can install Bun automatically)
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-500">—</span>
              Claude Code configured after install
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
        Openade is open source. tryade.dev documents install paths; the app runs from your clone.
      </footer>
    </div>
  );
}
