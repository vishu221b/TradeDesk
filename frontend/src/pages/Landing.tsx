import { useTheme } from "../context/ThemeContext";
import { Reveal } from "../components/Reveal";
import { Particles } from "../components/Particles";
import { Aurora } from "../components/Aurora";
import {
  ArrowRight,
  Bolt,
  ChartBar,
  Chat,
  Check,
  Cpu,
  Database,
  Layers,
  Moon,
  Shield,
  Sun,
} from "../components/icons";

const FEATURES = [
  {
    icon: Bolt,
    title: "Agentic, not autocomplete",
    body: "A hand-written tool-use loop looks up your real jobs, invoices and customers — grounded answers, never guesses.",
  },
  {
    icon: Cpu,
    title: "Any model you like",
    body: "Claude, GPT, Gemini, local Ollama, or a built-in keyless mock. Swap providers without touching a line of logic.",
  },
  {
    icon: Shield,
    title: "Nothing is ever sent",
    body: "Quotes and customer messages are saved as drafts for a human to approve. The agent proposes; you decide.",
  },
  {
    icon: Database,
    title: "Your data, scoped to you",
    body: "Every read and write is filtered to your account. Multi-user from the ground up, backed by a real database.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect your operations",
    body: "Load your jobs, invoices and customers — or start from the rich sample dataset in one click.",
  },
  {
    n: "02",
    title: "Ask in plain English",
    body: "“Which invoices are overdue?” “Draft a quote for the Wilson garage job.” The agent calls the right tools and grounds every figure.",
  },
  {
    n: "03",
    title: "Review and approve",
    body: "Quotes and messages land as drafts. You stay in control of everything that leaves the building.",
  },
];

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-full overflow-y-auto">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-edge-light/60 bg-canvas-light/80 backdrop-blur dark:border-edge-dark/60 dark:bg-canvas-dark/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
            <Bolt className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">TradeDesk</span>
          <nav className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="btn-ghost px-2.5 py-2" aria-label="Toggle theme">
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button onClick={onGetStarted} className="btn-primary">
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-radial">
        <Aurora />
        <Particles quantity={70} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div className="animate-fade-up">
            <span className="chip border border-accent/30 bg-accent-soft text-accent backdrop-blur">
              <span className="motion-safe:animate-pulse-glow">
                <Bolt className="h-3.5 w-3.5" />
              </span>{" "}
              AI agent for trade &amp; field service
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              The AI job desk that <span className="brand-text">knows your business</span>.
            </h1>
            <p className="mt-4 max-w-md text-base text-gray-600 dark:text-gray-300">
              TradeDesk answers questions about your jobs and invoices and drafts quotes and customer
              messages — grounded in your own operational data, across any AI model.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={onGetStarted} className="btn-primary px-5 py-2.5 text-base">
                Get started <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={onGetStarted} className="btn-outline px-5 py-2.5 text-base">
                Try the demo
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              No API key required — the keyless mock provider works out of the box.
            </p>
          </div>

          <div className="animate-fade-up [animation-delay:120ms] motion-safe:animate-float">
            <HeroMock />
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-edge-light bg-panel-light dark:border-edge-dark dark:bg-panel-dark">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4 md:px-8">
          {[
            { k: "5+", v: "AI providers supported" },
            { k: "100%", v: "answers grounded in your data" },
            { k: "0", v: "messages auto-sent" },
            { k: "Multi-user", v: "database-backed by default" },
          ].map((s, i) => (
            <Reveal key={s.v} delay={i * 80} className="text-center">
              <p className="text-2xl font-bold brand-text md:text-3xl">{s.k}</p>
              <p className="mt-1 text-xs text-gray-500">{s.v}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Built for the way trades actually work</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Precise, honest, and provider-agnostic. Everything below the loop is production plumbing —
            auth, persistence, and a clean integration boundary.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="card h-full p-6 transition hover:-translate-y-1 hover:shadow-glow">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-edge-light bg-panel-light dark:border-edge-dark dark:bg-panel-dark">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <Reveal className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">From question to draft in three steps</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="card h-full p-6">
                  <span className="text-3xl font-extrabold brand-text">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Analytics highlight */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <span className="chip border border-gold/40 bg-gold-soft text-gold-hover">
              <ChartBar className="h-3.5 w-3.5" /> Live dashboard
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              See cashflow, overdue and retention at a glance
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              A home dashboard turns your operational data into the numbers that matter — revenue
              collected, money outstanding, overdue balances, quote pipeline and customer retention.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Revenue trend across the last six months",
                "Top overdue invoices, ready to chase",
                "Job funnel from quote to completion",
                "Collection rate and repeat-customer retention",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <DashboardMock />
          </Reveal>
        </div>
      </section>

      {/* Providers */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <Reveal className="card flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6 text-sm font-medium text-gray-500">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" /> Works with
          </span>
          {["Claude", "GPT", "Gemini", "Ollama", "Mock"].map((p) => (
            <span key={p}>{p}</span>
          ))}
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center text-white shadow-glow-lg md:px-12">
            <Particles quantity={50} color="255,255,255" />
            <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Put an AI on the job desk today
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">
              Sign in and load the sample data to explore — or connect your own. No keys, no setup,
              no risk of anything being sent.
            </p>
            <button
              onClick={onGetStarted}
              className="btn mt-7 bg-white px-6 py-3 text-base font-semibold text-accent hover:bg-white/90"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-edge-light py-8 dark:border-edge-dark">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-gray-500 md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <Chat className="h-4 w-4 text-accent" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">TradeDesk</span>
            <span>· AI job desk for trade &amp; field service</span>
          </div>
          <span>Drafts only — nothing is ever auto-sent.</span>
        </div>
      </footer>
    </div>
  );
}

/* --- decorative mocks (pure presentation) --- */

function HeroMock() {
  return (
    <div className="glow-border card overflow-hidden shadow-glow-lg">
      <div className="flex items-center gap-1.5 border-b border-edge-light px-4 py-3 dark:border-edge-dark">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs text-gray-400">TradeDesk · Agent</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl bg-accent px-3.5 py-2 text-sm text-white">
          Which invoices are overdue, and draft a reminder for the worst one?
        </div>
        <div className="flex gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[10px] font-bold text-white">
            AI
          </div>
          <div className="space-y-2">
            <div className="rounded-2xl border border-edge-light px-3.5 py-2 text-sm dark:border-edge-dark">
              Found <strong>4 overdue invoices</strong>. The largest is{" "}
              <strong>INV-9012 — Northgate Warehousing</strong> at $4,820, 21 days overdue.
            </div>
            <div className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-accent">
              ⚙ list_invoices · draft_customer_message
            </div>
            <div className="rounded-2xl border border-dashed border-gold/50 bg-gold-soft px-3.5 py-2 text-sm">
              <span className="font-semibold">Draft reminder saved</span> — review &amp; approve before
              sending.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMock() {
  const bars = [40, 55, 48, 70, 62, 88];
  return (
    <div className="card p-5 shadow-glow">
      <div className="grid grid-cols-3 gap-3">
        {[
          { k: "Collected", v: "$48k", cls: "text-accent" },
          { k: "Outstanding", v: "$12k", cls: "" },
          { k: "Overdue", v: "$4.8k", cls: "text-red-500" },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-edge-light p-3 dark:border-edge-dark">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{s.k}</p>
            <p className={`mt-0.5 text-lg font-bold ${s.cls}`}>{s.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-28 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-brand-gradient"
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}
