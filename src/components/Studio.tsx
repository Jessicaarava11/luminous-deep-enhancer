import { useEffect, useRef, useState } from "react";
import { EnhancementEngine, EnhancementSettings, DEFAULT_SETTINGS } from "@/lib/enhancementEngine";
import { SettingsPanel } from "./SettingsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Image as ImageIcon, Video as VideoIcon, Camera, Download, Save, Loader2 } from "lucide-react";
import { SAMPLES } from "@/lib/sampleImages";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type SourceType = "image" | "video" | "webcam" | "sample";

interface Props {
  user: User | null;
  onHistoryChanged: () => void;
}

export const Studio = ({ user, onHistoryChanged }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<EnhancementEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [settings, setSettings] = useState<EnhancementSettings>({ ...DEFAULT_SETTINGS });
  const [sourceType, setSourceType] = useState<SourceType>("sample");
  const [imageUrl, setImageUrl] = useState<string | null>(SAMPLES[0].url);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState<string>(SAMPLES[0].title);

  // Init engine
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      engineRef.current = new EnhancementEngine(canvasRef.current);
    } catch (e) {
      console.error(e);
      toast.error("WebGL2 isn't available in this browser.");
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Sync settings into engine each render
  useEffect(() => {
    if (engineRef.current) engineRef.current.settings = settings;
    // re-render still frame
    requestStill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  /** Render a single still frame from the current image, if any. */
  const requestStill = () => {
    const e = engineRef.current;
    if (!e) return;
    if (sourceType === "image" || sourceType === "sample") {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        e.process(img, img.naturalWidth, img.naturalHeight);
      }
    } else if (sourceType === "video" || sourceType === "webcam") {
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth > 0) {
        e.process(v, v.videoWidth, v.videoHeight);
      }
    }
  };

  // RAF loop for live sources
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceType !== "video" && sourceType !== "webcam") return;
    const loop = () => {
      const e = engineRef.current;
      const v = videoRef.current;
      if (e && v && v.readyState >= 2 && !v.paused && v.videoWidth > 0) {
        e.process(v, v.videoWidth, v.videoHeight);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceType, videoUrl, streamActive]);

  // Cleanup webcam when leaving
  useEffect(() => {
    return () => stopWebcam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopWebcam = () => {
    const v = videoRef.current;
    if (v?.srcObject instanceof MediaStream) {
      v.srcObject.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStreamActive(false);
  };

  const handleImageFile = (file: File) => {
    stopWebcam();
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setVideoUrl(null);
    setSourceType("image");
    setTitle(file.name);
  };

  const handleVideoFile = (file: File) => {
    stopWebcam();
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setImageUrl(null);
    setSourceType("video");
    setTitle(file.name);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      setSourceType("webcam");
      setVideoUrl(null);
      setImageUrl(null);
      setTitle("Webcam capture");
      // wait a tick for video el
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play();
          setStreamActive(true);
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't access the webcam. Check browser permissions.");
    }
  };

  const pickSample = (s: (typeof SAMPLES)[number]) => {
    stopWebcam();
    setSourceType("sample");
    setImageUrl(s.url);
    setVideoUrl(null);
    setTitle(s.title);
  };

  const downloadEnhanced = async () => {
    const blob = await engineRef.current?.toBlob("image/png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToHistory = async () => {
    if (!user) {
      toast.error("Sign in to save to your history.");
      return;
    }
    if (!engineRef.current || !canvasRef.current) return;
    setSaving(true);
    try {
      // Render a thumbnail
      const blob = await engineRef.current.toBlob("image/jpeg", 0.85);
      if (!blob) throw new Error("Couldn't capture frame");
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("enhancements").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("enhancements").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("enhancements").insert({
        user_id: user.id,
        title,
        source_type: sourceType,
        thumbnail_url: signed?.signedUrl ?? null,
        settings: settings as never,
      });
      if (insErr) throw insErr;
      toast.success("Saved to your history.");
      onHistoryChanged();
    } catch (e: unknown) {
      console.error(e);
      toast.error("Couldn't save to history.");
    } finally {
      setSaving(false);
    }
  };

  const isVideoSource = sourceType === "video" || sourceType === "webcam";

  return (
    <section id="studio" className="relative px-4 py-16 md:px-8 md:py-24">
      <div className="absolute inset-0 -z-10 bg-aurora opacity-40" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold md:text-5xl">The <span className="text-gradient">Studio</span></h2>
          <p className="mt-3 text-muted-foreground">Upload an image or video, or open your webcam — see the original and enhanced result side by side.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Preview — separate Original / Enhanced panels */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Original panel */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-elegant">
                <div className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/80 backdrop-blur">
                  Original
                </div>
                <div className="flex h-full w-full items-center justify-center">
                  {(sourceType === "image" || sourceType === "sample") && imageUrl && (
                    <img
                      ref={imgRef}
                      src={imageUrl}
                      alt={title}
                      crossOrigin="anonymous"
                      onLoad={requestStill}
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                  {isVideoSource && (
                    <video
                      ref={videoRef}
                      src={videoUrl ?? undefined}
                      playsInline
                      muted
                      loop
                      autoPlay={!!videoUrl || sourceType === "webcam"}
                      controls={sourceType === "video"}
                      className="max-h-full max-w-full object-contain"
                      onLoadedData={requestStill}
                    />
                  )}
                </div>
              </div>

              {/* Enhanced panel */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-primary/30 bg-black shadow-glow">
                <div className="absolute left-3 top-3 z-10 rounded-full bg-gradient-primary px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-primary-foreground">
                  Enhanced
                </div>
                <div className="flex h-full w-full items-center justify-center">
                  <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass p-3">
              <div className="px-2 text-sm text-muted-foreground truncate max-w-[60%]">{title}</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full glass border-white/10" onClick={downloadEnhanced}>
                  <Download className="mr-1.5 h-4 w-4" /> PNG
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-gradient-primary text-primary-foreground"
                  onClick={saveToHistory}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <Tabs
              value={sourceType === "sample" ? "sample" : sourceType}
              onValueChange={(v) => {
                if (v === "webcam") {
                  startWebcam();
                } else if (v === "image" || v === "video" || v === "sample") {
                  if (v !== "webcam") stopWebcam();
                  setSourceType(v as SourceType);
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-4 rounded-full glass p-1">
                <TabsTrigger value="sample" className="rounded-full data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <ImageIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="image" className="rounded-full data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <Upload className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="video" className="rounded-full data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <VideoIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="webcam" className="rounded-full data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <Camera className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sample" className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => pickSample(s)}
                      className={`group relative aspect-square overflow-hidden rounded-xl border transition-all ${
                        imageUrl === s.url ? "border-primary ring-glow" : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <img src={s.thumb} alt={s.title} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left text-[10px] font-medium">
                        {s.title}
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="image" className="mt-4">
                <Dropzone
                  accept="image/*"
                  onFile={handleImageFile}
                  hint="Drop an image (JPG / PNG / WebP)"
                />
              </TabsContent>

              <TabsContent value="video" className="mt-4">
                <Dropzone
                  accept="video/*"
                  onFile={handleVideoFile}
                  hint="Drop a video (MP4 / WebM)"
                />
              </TabsContent>

              <TabsContent value="webcam" className="mt-4">
                <div className="rounded-xl glass p-4 text-sm text-muted-foreground space-y-2">
                  <p>Live webcam {streamActive ? "is active" : "is off"}.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-white/10" onClick={startWebcam}>Start</Button>
                    <Button size="sm" variant="outline" className="border-white/10" onClick={stopWebcam}>Stop</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <SettingsPanel settings={settings} onChange={setSettings} />
          </div>
        </div>

        {/* Hidden file inputs */}
        <input id="img-input" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
        <input id="vid-input" type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])} />
      </div>
    </section>
  );
};

const Dropzone = ({
  accept,
  onFile,
  hint,
}: {
  accept: string;
  onFile: (f: File) => void;
  hint: string;
}) => {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm transition-all ${
        over ? "border-primary bg-primary/5" : "border-white/15 hover:border-white/30"
      }`}
    >
      <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
      <span className="text-muted-foreground">{hint}</span>
      <span className="mt-1 text-xs text-muted-foreground/70">or click to browse</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
};
