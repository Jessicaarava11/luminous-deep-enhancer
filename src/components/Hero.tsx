import { Button } from "@/components/ui/button";
import { ArrowDown, Sparkles } from "lucide-react";

interface HeroProps {
  onLaunch: () => void;
}

export const Hero = ({ onLaunch }: HeroProps) => {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://res.cloudinary.com/dfonotyfb/video/upload/v1775585556/dds3_1_rqhg7x.mp4"
          type="video/mp4"
        />
      </video>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/70 via-background/40 to-background" />
      <div className="absolute inset-0 z-10 bg-aurora opacity-60 mix-blend-screen" />
      <div className="absolute inset-0 z-10 [background:radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_100%)]" />

      {/* Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-up [animation-delay:80ms]">
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium tracking-wide text-foreground/80">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            HaskeAi
          </span>
        </div>

        <h1 className="mt-8 max-w-5xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl animate-fade-up [animation-delay:200ms]">
          See what the{" "}
          <span className="text-gradient">darkness</span>{" "}
          hides.
        </h1>

        <p className="mt-6 max-w-2xl text-base text-foreground/75 sm:text-lg md:text-xl animate-fade-up [animation-delay:380ms]">
          HaskeAi restores low-light photos, video, and live webcam streams in real time —
          right inside your browser. Upload images & videos or stream from your webcam. Just light.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-up [animation-delay:560ms]">
          <Button size="lg" onClick={onLaunch} className="h-12 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95 hover:scale-[1.02] transition-[var(--transition-smooth)] px-7 text-base font-semibold">
            Launch the Studio
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onLaunch}
            className="h-12 rounded-full glass border-white/10 px-7 text-base font-medium hover:bg-white/5"
          >
            See it on a sample
          </Button>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-float-slow text-foreground/50">
          <ArrowDown className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
};
