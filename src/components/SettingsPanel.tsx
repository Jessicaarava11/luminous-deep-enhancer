import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS, EnhancementSettings } from "@/lib/enhancementEngine";
import { RotateCcw } from "lucide-react";

interface Props {
  settings: EnhancementSettings;
  onChange: (s: EnhancementSettings) => void;
}

const Row = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-foreground/80">{format ? format(value) : value.toFixed(2)}</span>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
  </div>
);

export const SettingsPanel = ({ settings, onChange }: Props) => {
  const set = (k: keyof EnhancementSettings) => (v: number) => onChange({ ...settings, [k]: v });
  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold tracking-wide">Enhancement</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1 h-3 w-3" /> Reset
        </Button>
      </div>
      <Row label="Curve α" value={settings.alpha} min={0} max={1} step={0.01} onChange={set("alpha")} />
      <Row label="Iterations" value={settings.iterations} min={1} max={8} step={1} onChange={set("iterations")} format={(v) => v.toFixed(0)} />
      <Row label="Retinex" value={settings.retinex} min={0} max={1} step={0.01} onChange={set("retinex")} />
      <Row label="Saturation" value={settings.saturation} min={0} max={2} step={0.01} onChange={set("saturation")} />
      <Row label="Temperature" value={settings.temperature} min={-1} max={1} step={0.01} onChange={set("temperature")} />
      <Row label="Denoise" value={settings.denoise} min={0} max={1} step={0.01} onChange={set("denoise")} />
      <Row label="Gamma" value={settings.gamma} min={0.4} max={1.6} step={0.01} onChange={set("gamma")} />
    </div>
  );
};
