import { useEffect, useRef, useState, useCallback } from "react";
import { EnhancementEngine, EnhancementSettings, DEFAULT_SETTINGS } from "@/lib/enhancementEngine";
import { SettingsPanel } from "./SettingsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Image as ImageIcon, Video as VideoIcon, Camera, Download, Save, Loader2, X } from "lucide-react";
import { SAMPLES } from "@/lib/sampleImages";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type SourceType = "image" | "video" | "webcam" | "sample";

interface Props {
  user: User | null;
  onHistoryChanged: () => void;
}

const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 100;

export const Studio = ({ user, onHistoryChanged }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<EnhancementEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<EnhancementSettings>({ ...DEFAULT_SETTINGS });
  const [sourceType, setSourceType] = useState<SourceType>("sample");
  const [imageUrl, setImageUrl] = useState<string | null>(SAMPLES[0].url);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [title, setTitle] = useState<string>(SAMPLES[0].title);
  const [isSampleUrl, setIsSampleUrl] = useState(true);

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
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  /** Render a single still frame from the current image, if any. */
  const requestStill = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (sourceType === "image" || sourceType === "sample") {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          e.process(img, img.naturalWidth, img.naturalHeight);
        } catch (err) {
          console.error("Render error:", err);
        }
      }
    } else if (sourceType === "video" || sourceType === "webcam") {
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth > 0) {
        try {
          e.process(v, v.videoWidth, v.videoHeight);
        } catch (err) {
          console.error("Render error:", err);
        }
      }
    }
  }, [sourceType]);

  // Sync settings into engine + re-render
  useEffect(() => {
    if (engineRef.current) engineRef.current.settings = settings;
    requestStill();
  }, [settings, requestStill]);

  // Re-render when source/url changes (still images)
  useEffect(() => {
    if (sourceType === "image" || sourceType === "sample") {
      // Defer to allow img element to mount/load
      const id = requestAnimationFrame(() => requestStill());
      return () => cancelAnimationFrame(id);
    }
  }, [sourceType, imageUrl, requestStill]);

  // RAF loop for live sources
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceType !== "video" && sourceType !== "webcam") return;
    const loop = () => {
      const e = engineRef.current;
      const v = videoRef.current;
      if (e && v && v.readyState >= 2 && !v.paused && v.videoWidth > 0) {
        try {
          e.process(v, v.videoWidth, v.videoHeight);
        } catch (err) {
          console.error("Frame render error:", err);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceType, videoUrl, streamActive]);

  // Cleanup webcam on unmount
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

  const revokePrevObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Max ${MAX_IMAGE_MB}MB.`);
      return;
    }
    stopWebcam();
    revokePrevObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setLoadingSource(true);
    setIsSampleUrl(false);
    setVideoUrl(null);
    setImageUrl(url);
    setSourceType("image");
    setTitle(file.name);
    toast.success("Image loaded");
  };

  const handleVideoFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4, WebM).");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video is too large. Max ${MAX_VIDEO_MB}MB.`);
      return;
    }
    stopWebcam();
    revokePrevObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setLoadingSource(true);
    setIsSampleUrl(false);
    setImageUrl(null);
    setVideoUrl(url);
    setSourceType("video");
    setTitle(file.name);
    toast.success("Video loaded");
  };

  const startWebcam = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Webcam isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      revokePrevObjectUrl();
      setVideoUrl(null);
      setImageUrl(null);
      setTitle("Webcam capture");
      setSourceType("webcam");
      // wait a tick for video el
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().catch((err) => console.error("Webcam play error:", err));
          setStreamActive(true);
          toast.success("Webcam started");
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't access the webcam. Check browser permissions.");
    }
  };

  const pickSample = (s: (typeof SAMPLES)[number]) => {
    stopWebcam();
    revokePrevObjectUrl();
    setLoadingSource(true);
    setIsSampleUrl(true);
    setSourceType("sample");
    setVideoUrl(null);
    setImageUrl(s.url);
    setTitle(s.title);
  };

  const clearSource = () => {
    stopWebcam();
    revokePrevObjectUrl();
    setImageUrl(null);
    setVideoUrl(null);
    setTitle("No source");
  };

  const downloadEnhanced = async () => {
    const blob = await engineRef.current?.toBlob("image/png");
    if (!blob) {
      toast.error("Nothing to download yet.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `haske-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToHistory = async () => {
    if (!user) {
      toast.error("Sign in to save to your history.");
      return;
    }
    if (!engineRef.current || !canvasRef.current) return;
    if (canvasRef.current.width === 0) {
      toast.error("Load a source before saving.");
      return;
    }
    setSaving(true);
    try {
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
  const hasSource = !!(imageUrl || videoUrl || streamActive);

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
                {loadingSource && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                <div className="flex h-full w-full items-center justify-center">
                  {(sourceType === "image" || sourceType === "sample") && imageUrl && (
                    <img
                      key={imageUrl}
                      ref={imgRef}
                      src={imageUrl}
                      alt={title}
                      {...(isSampleUrl ? { crossOrigin: "anonymous" as const } : {})}
                      onLoad={() => {
                        setLoadingSource(false);
                        requestStill();
                      }}
                      onError={() => {
                        setLoadingSource(false);
                        toast.error("Couldn't load that image.");
                      }}
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
                      onLoadedData={() => {
                        setLoadingSource(false);
                        requestStill();
                      }}
                      onError={() => {
                        setLoadingSource(false);
                        toast.error("Couldn't load that video.");
                      }}
                    />
                  )}
                  {!hasSource && !loadingSource && (
                    <div className="text-center text-sm text-muted-foreground">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      <p>No source loaded</p>
                    </div>
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
              <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground truncate max-w-[60%]">
                <span className="truncate">{title}</span>
                {hasSource && (
                  <button
                    onClick={clearSource}
                    className="text-muted-foreground/60 hover:text-foreground"
                    aria-label="Clear source"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full glass border-white/10" onClick={downloadEnhanced} disabled={!hasSource}>
                  <Download className="mr-1.5 h-4 w-4" /> PNG
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-gradient-primary text-primary-foreground"
                  onClick={saveToHistory}
                  disabled={saving || !hasSource}
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
                  stopWebcam();
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
                  hint={`Drop an image (JPG / PNG / WebP) — up to ${MAX_IMAGE_MB}MB`}
                />
              </TabsContent>

              <TabsContent value="video" className="mt-4">
                <Dropzone
                  accept="video/*"
                  onFile={handleVideoFile}
                  hint={`Drop a video (MP4 / WebM) — up to ${MAX_VIDEO_MB}MB`}
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // reset so re-uploading the same file fires onChange
          e.target.value = "";
        }}
      />
    </label>
  );
};
