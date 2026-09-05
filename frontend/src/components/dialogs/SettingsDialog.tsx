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
import { SettingsService } from "@bindings/nst-go/cmd/nst-desktop";
import type { Settings } from "@bindings/nst-go/cmd/nst-desktop";
import { toast } from "sonner";
import { Save, Settings as SettingsIcon } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [settings, setSettings] = useState<Settings>({
    default_provider: "mock",
    default_model: "gemini-2.5-flash",
    gemini_api_key: "",
    openai_api_key: "",
    openai_base_url: "",
    google_api_key: "",
    chanomhub_token: "",
    default_source_lang: "Japanese",
    default_target_lang: "Thai",
    default_batch_size: 10,
    default_concurrency: 4,
    theme: "dark",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      SettingsService.GetSettings()
        .then((s) => {
          if (s) setSettings(s);
        })
        .catch((err) => {
          console.error("Failed to load settings:", err);
        });
    }
  }, [open]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await SettingsService.SaveSettings(settings);
      toast.success("Settings saved successfully");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="w-5 h-5 text-[#3399ff]" />
            Application Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Provider Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                Default Provider
              </label>
              <select
                value={settings.default_provider}
                onChange={(e) =>
                  setSettings({ ...settings, default_provider: e.target.value })
                }
                className="w-full h-8 rounded-md border border-[#3a3a3a] bg-[#222222] px-2 text-sm text-[#f0f0f0] focus:outline-none focus:border-[#3399ff]"
              >
                <option value="mock">Mock (Offline Test Provider)</option>
                <option value="gemini">Google Gemini AI</option>
                <option value="openai">OpenAI / Ollama / Custom API</option>
                <option value="google">Google Translate API</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                Default Model
              </label>
              <Input
                value={settings.default_model}
                onChange={(e) =>
                  setSettings({ ...settings, default_model: e.target.value })
                }
                placeholder="e.g. gemini-2.5-flash or gpt-4o-mini"
              />
            </div>
          </div>

          {/* API Keys */}
          <div className="border-t border-[#333333] pt-3 space-y-3">
            <div className="text-xs font-semibold text-[#3399ff] uppercase tracking-wider">
              API Keys & Credentials
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">
                Gemini API Key
              </label>
              <Input
                type="password"
                value={settings.gemini_api_key}
                onChange={(e) =>
                  setSettings({ ...settings, gemini_api_key: e.target.value })
                }
                placeholder="AIzaSy..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  OpenAI API Key
                </label>
                <Input
                  type="password"
                  value={settings.openai_api_key}
                  onChange={(e) =>
                    setSettings({ ...settings, openai_api_key: e.target.value })
                  }
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  OpenAI Base URL (Optional)
                </label>
                <Input
                  value={settings.openai_base_url}
                  onChange={(e) =>
                    setSettings({ ...settings, openai_base_url: e.target.value })
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">
                Chanomhub API Token
              </label>
              <Input
                type="password"
                value={settings.chanomhub_token}
                onChange={(e) =>
                  setSettings({ ...settings, chanomhub_token: e.target.value })
                }
                placeholder="JWT Token for publishing"
              />
            </div>
          </div>

          {/* Translation Defaults */}
          <div className="border-t border-[#333333] pt-3 space-y-3">
            <div className="text-xs font-semibold text-[#3399ff] uppercase tracking-wider">
              Translation Pipeline Defaults
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  Default Source Language
                </label>
                <Input
                  value={settings.default_source_lang}
                  onChange={(e) =>
                    setSettings({ ...settings, default_source_lang: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  Default Target Language
                </label>
                <Input
                  value={settings.default_target_lang}
                  onChange={(e) =>
                    setSettings({ ...settings, default_target_lang: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  Batch Size (lines per request)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.default_batch_size}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_batch_size: parseInt(e.target.value) || 10,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1">
                  Concurrency (workers)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={settings.default_concurrency}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_concurrency: parseInt(e.target.value) || 4,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
