import { Layers, Cpu, Eye, Download } from "lucide-react";

const steps = [
  {
    icon: Layers,
    title: "Pack",
    body: "Your low-light frame is split into multi-scale spatial bands — the GPU equivalent of your project's pack() operation.",
  },
  {
    icon: Cpu,
    title: "Curve",
    body: "Iterated Zero-DCE light-enhancement curves lift dark regions while preserving edges and gradients.",
  },
  {
    icon: Eye,
    title: "Retinex",
    body: "A single-scale Retinex pass restores local contrast, then we re-balance temperature and saturation in linear light.",
  },
  {
    icon: Download,
    title: "Unpack",
    body: "Bands are recombined and tone-mapped back to display sRGB — exported as PNG or saved to your private gallery.",
  },
];

export const HowItWorks = () => (
  <section id="how" className="relative px-4 py-20 md:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 text-center">
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-primary/80">The pipeline</span>
        <h2 className="mt-3 font-display text-3xl font-bold md:text-5xl">
          Pack. Enhance. <span className="text-gradient">Unpack.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          A faithful, GPU-accelerated re-imagining of the Zero-DCE × Retinex pack/unpack architecture from your research project — running entirely in the browser.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="group relative overflow-hidden rounded-2xl glass p-6 shadow-card transition-[var(--transition-smooth)] hover:-translate-y-1 hover:ring-glow">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="absolute right-4 top-4 font-mono text-xs text-muted-foreground/60">0{i + 1}</div>
            <h3 className="font-display text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
