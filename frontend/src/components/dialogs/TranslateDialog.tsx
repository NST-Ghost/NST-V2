import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  TranslationService,
  SettingsService,
} from "@bindings/nst-go/cmd/nst-desktop";
import type { TranslationDonePayload } from "@bindings/nst-go/cmd/nst-desktop";
import type { TranslationProgress } from "@bindings/nst-go/pkg/model";
import { Events } from "@wailsio/runtime";
import { toast } from "sonner";
import { Languages, Loader2, Play, XCircle } from "lucide-react";

interface TranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFile?: string;
  sourceLang: string;
  targetLang: string;
  onFinished?: () => void;
}

export const TranslateDialog: React.FC<TranslateDialogProps> = ({
  open,
  onOpenChange,
  currentFile,
  sourceLang,
  targetLang,
  onFinished,
}) => {
  const [provider, setProvider] = useState("mock");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [scope, setScope] = useState<"all" | "untranslated" | "file">("untranslated");
  const [batchSize, setBatchSize] = useState(10);
  const [concurrency, setConcurrency] = useState(4);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);

  // Load defaults from settings
  useEffect(() => {
    if (open) {
      SettingsService.GetSettings().then((s) => {
        if (s) {
          setProvider(s.default_provider || "mock");
          setModelName(s.default_model || "");
          setBatchSize(s.default_batch_size || 10);
          setConcurrency(s.default_concurrency || 4);

          if (s.default_provider === "gemini") {
            setApiKey(s.gemini_api_key || "");
          } else if (s.default_provider === "openai") {
            setApiKey(s.openai_api_key || "");
            setBaseURL(s.openai_base_url || "");
          } else if (s.default_provider === "google") {
            setApiKey(s.google_api_key || "");
          }
        }
      });

      TranslationService.IsRunning().then(setIsRunning);
    }
  }, [open]);

  // Update apiKey when provider changes
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    SettingsService.GetSettings().then((s) => {
      if (!s) return;
      if (newProvider === "gemini") {
        setApiKey(s.gemini_api_key || "");
      } else if (newProvider === "openai") {
        setApiKey(s.openai_api_key || "");
        setBaseURL(s.openai_base_url || "");
      } else if (newProvider === "google") {
        setApiKey(s.google_api_key || "");
      } else {
        setApiKey("");
      }
    });
  };

  // Subscribe to translation events
  useEffect(() => {
    let unregProgress: (() => void) | undefined;
    let unregDone: (() => void) | undefined;

    try {
      unregProgress = Events.On("translation:progress", (event: any) => {
        const data = event.data?.[0] || event.data;
        if (data) {
          setProgress(data as TranslationProgress);
        }
      });

      unregDone = Events.On("translation:done", (event: any) => {
        const payload = (event.data?.[0] || event.data) as TranslationDonePayload;
        setIsRunning(false);
        if (payload?.success) {
          toast.success("Translation finished successfully!");
        } else {
          toast.error(`Translation finished with errors: ${payload?.error || "Unknown error"}`);
        }
        if (onFinished) onFinished();
      });
    } catch (e) {
      console.warn("Event registration error:", e);
    }

    return () => {
      if (unregProgress) unregProgress();
      if (unregDone) unregDone();
    };
  }, [onFinished]);

  const handleStart = async () => {
    try {
      setIsRunning(true);
      setProgress(null);

      let effectiveScope = scope === "file" ? currentFile || "all" : scope;

      await TranslationService.Start({
        provider: {
          name: provider,
          api_key: apiKey,
          model: modelName,
          base_url: baseURL,
        },
        source_lang: sourceLang,
        target_lang: targetLang,
        batch_size: batchSize,
        concurrency: concurrency,
        scope: effectiveScope,
      });

      toast.info("Translation pipeline started in background");
    } catch (err: any) {
      setIsRunning(false);
      toast.error(`Failed to start translation: ${err?.message || err}`);
    }
  };

  const handleCancel = async () => {
    try {
      await TranslationService.Cancel();
      toast.warning("Cancel request sent");
    } catch (err: any) {
      toast.error(`Failed to cancel: ${err?.message || err}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Languages className="w-5 h-5 text-[#3399ff]" />
            AI Translation Pipeline
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Provider Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                Translation Service
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={isRunning}
                className="w-full h-8 rounded-md border border-[#3a3a3a] bg-[#222222] px-2 text-sm text-[#f0f0f0] focus:outline-none focus:border-[#3399ff] disabled:opacity-50"
              >
                <option value="mock">Mock (Fast Offline Preview)</option>
                <option value="gemini">Google Gemini AI</option>
                <option value="openai">OpenAI / Ollama</option>
                <option value="google">Google Translate API</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                Model Name
              </label>
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isRunning}
                placeholder="e.g. gemini-2.5-flash"
              />
            </div>
          </div>

          {/* API Key */}
          {provider !== "mock" && (
            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                API Key
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isRunning}
                placeholder="Enter API Key"
              />
            </div>
          )}

          {/* Scope */}
          <div>
            <label className="block text-xs font-semibold text-[#a0a0a0] mb-1.5">
              Translation Scope
            </label>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[#d0d0d0] cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "untranslated"}
                  onChange={() => setScope("untranslated")}
                  disabled={isRunning}
                  className="accent-[#3399ff]"
                />
                Untranslated Only
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#d0d0d0] cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  disabled={isRunning}
                  className="accent-[#3399ff]"
                />
                All Entries
              </label>
              {currentFile && (
                <label className="flex items-center gap-1.5 text-xs text-[#d0d0d0] cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "file"}
                    onChange={() => setScope("file")}
                    disabled={isRunning}
                    className="accent-[#3399ff]"
                  />
                  Selected File ({currentFile})
                </label>
              )}
            </div>
          </div>

          {/* Concurrency & Batch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#888888] mb-1">
                Batch Size
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                disabled={isRunning}
              />
            </div>
            <div>
              <label className="block text-xs text-[#888888] mb-1">
                Workers (Concurrency)
              </label>
              <Input
                type="number"
                min={1}
                max={16}
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value) || 4)}
                disabled={isRunning}
              />
            </div>
          </div>

          {/* Live Progress Bar */}
          {isRunning && (
            <div className="border border-[#383838] bg-[#1e1e1e] p-3 rounded-md space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#3399ff] flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Translating…
                </span>
                <span className="font-mono text-white">
                  {(progress?.percent || 0).toFixed(1)}%
                </span>
              </div>
              <Progress value={progress?.percent || 0} className="h-2" />
              <div className="flex justify-between text-xs text-[#888888] font-mono">
                <span>
                  {progress?.completed || 0} / {progress?.total || 0} lines
                </span>
                <span className="truncate max-w-[180px]">
                  {progress?.current_file || "initializing…"}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isRunning ? (
            <Button
              variant="destructive"
              onClick={handleCancel}
              className="gap-1.5 w-full"
            >
              <XCircle className="w-4 h-4" />
              Cancel Translation
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleStart} className="gap-1.5">
                <Play className="w-4 h-4 fill-white" />
                Start Translating
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
