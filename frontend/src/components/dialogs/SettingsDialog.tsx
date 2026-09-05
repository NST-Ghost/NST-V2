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
import {
  Save,
  Settings as SettingsIcon,
  Zap,
  Bot,
  Key,
  Puzzle,
  Sliders,
  Info,
  Eye,
  EyeOff,
  RefreshCw,
  Layers,
} from "lucide-react";
import { fetchProviders, BUILTIN_PROVIDERS, type ProviderInfo } from "@/lib/providers";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "providers" | "models" | "keys" | "plugins" | "translation" | "about";

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("providers");
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [providers, setProviders] = useState<ProviderInfo[]>(BUILTIN_PROVIDERS);
  const [isRefreshingPlugins, setIsRefreshingPlugins] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    default_provider: "mock",
    default_model: "gemini-2.5-flash",
    gemini_api_key: "",
    openai_api_key: "",
    openai_base_url: "",
    google_api_key: "",
    chanomhub_token: "",
    plugin_keys: {},
    plugin_base_urls: {},
    default_source_lang: "Japanese",
    default_target_lang: "Thai",
    default_batch_size: 10,
    default_concurrency: 4,
    theme: "dark",
  });
  const [saving, setSaving] = useState(false);

  const loadProvidersData = async () => {
    try {
      const list = await fetchProviders();
      setProviders(list);
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  };

  useEffect(() => {
    if (open) {
      loadProvidersData();
      SettingsService.GetSettings()
        .then((s) => {
          if (s) {
            setSettings({
              ...s,
              plugin_keys: s.plugin_keys || {},
              plugin_base_urls: s.plugin_base_urls || {},
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load settings:", err);
        });
    }
  }, [open]);

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePluginKeyChange = (providerName: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      plugin_keys: {
        ...(prev.plugin_keys || {}),
        [providerName]: value,
      },
    }));
  };

  const handlePluginBaseURLChange = (providerName: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      plugin_base_urls: {
        ...(prev.plugin_base_urls || {}),
        [providerName]: value,
      },
    }));
  };

  const handleRefreshPlugins = async () => {
    setIsRefreshingPlugins(true);
    await loadProvidersData();
    setIsRefreshingPlugins(false);
    toast.success("Discovered provider plugins reloaded");
  };

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

  const activeProviderInfo = providers.find((p) => p.name === settings.default_provider);
  const customPlugins = providers.filter((p) => p.is_custom);

  const navItems = [
    { id: "providers" as TabType, label: "Providers", icon: Zap },
    { id: "models" as TabType, label: "Models", icon: Bot },
    { id: "keys" as TabType, label: "API Keys", icon: Key },
    {
      id: "plugins" as TabType,
      label: `Plugins (${customPlugins.length})`,
      icon: Puzzle,
    },
    { id: "translation" as TabType, label: "Translation", icon: Sliders },
    { id: "about" as TabType, label: "About", icon: Info },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[560px] p-0 flex flex-col overflow-hidden bg-[#181818] border-[#333333]">
        <DialogHeader className="p-4 pb-3 border-b border-[#2b2b2b]">
          <DialogTitle className="flex items-center gap-2 text-base text-[#f0f0f0]">
            <SettingsIcon className="w-5 h-5 text-[#3399ff]" />
            Preferences & Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-48 bg-[#141414] border-r border-[#2b2b2b] p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                    isActive
                      ? "bg-[#252525] text-white font-semibold border-l-2 border-[#3399ff]"
                      : "text-[#888888] hover:text-[#cccccc] hover:bg-[#1d1d1d]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#3399ff]" : "text-[#777777]"}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#1b1b1b] text-sm text-[#e0e0e0]">
            {/* 1. Providers Tab */}
            {activeTab === "providers" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Translation Providers</h3>
                  <p className="text-xs text-[#888888] mt-0.5">
                    Select default translation module and custom endpoint routes.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                      Active Default Provider
                    </label>
                    <select
                      value={settings.default_provider}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = providers.find((p) => p.name === val);
                        setSettings({
                          ...settings,
                          default_provider: val,
                          default_model: found?.default_model || (found?.available_models?.[0] || settings.default_model),
                        });
                      }}
                      className="w-full h-9 rounded-md border border-[#3a3a3a] bg-[#222222] px-3 text-sm text-[#f0f0f0] focus:outline-none focus:border-[#3399ff]"
                    >
                      {providers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.display_name} {p.is_custom ? "[External Plugin]" : "[Built-in]"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Provider Info Card */}
                  {activeProviderInfo && (
                    <div className="p-3 bg-[#222222] border border-[#2e2e2e] rounded-md space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white">
                          {activeProviderInfo.display_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            activeProviderInfo.is_custom
                              ? "bg-[#3e2723] text-[#ffb74d]"
                              : "bg-[#1e3a5f] text-[#3399ff]"
                          }`}
                        >
                          {activeProviderInfo.is_custom ? "PLUGIN DRIVER" : "BUILT-IN"}
                        </span>
                      </div>
                      <p className="text-[#888888] text-[11px]">
                        {activeProviderInfo.description || "Declarative translation driver."}
                      </p>
                      {activeProviderInfo.base_url && (
                        <div className="text-[11px] text-[#777] flex items-center gap-1 font-mono">
                          <span>Endpoint:</span>
                          <code className="text-[#a0a0a0]">{activeProviderInfo.base_url}</code>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Base URL (if openai or custom plugin) */}
                  {(activeProviderInfo?.is_custom || settings.default_provider === "openai") && (
                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                        Endpoint Base URL Override (Optional)
                      </label>
                      <Input
                        value={
                          activeProviderInfo?.is_custom
                            ? settings.plugin_base_urls?.[settings.default_provider] || ""
                            : settings.openai_base_url
                        }
                        onChange={(e) => {
                          if (activeProviderInfo?.is_custom) {
                            handlePluginBaseURLChange(settings.default_provider, e.target.value);
                          } else {
                            setSettings({ ...settings, openai_base_url: e.target.value });
                          }
                        }}
                        placeholder={activeProviderInfo?.base_url || "https://api.openai.com/v1"}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Models Tab */}
            {activeTab === "models" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Model Selection</h3>
                  <p className="text-xs text-[#888888] mt-0.5">
                    Configure preferred AI model for {activeProviderInfo?.display_name || settings.default_provider}.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                      Default Model String
                    </label>
                    <Input
                      value={settings.default_model}
                      onChange={(e) =>
                        setSettings({ ...settings, default_model: e.target.value })
                      }
                      placeholder="e.g. gemini-2.5-flash, claude-3-7-sonnet"
                    />
                  </div>

                  {/* Dynamic Model Suggestions from Provider/Plugin definition */}
                  {activeProviderInfo?.available_models && activeProviderInfo.available_models.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-semibold text-[#a0a0a0]">
                        Available Models from {activeProviderInfo.display_name}:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {activeProviderInfo.available_models.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSettings({ ...settings, default_model: m })}
                            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                              settings.default_model === m
                                ? "bg-[#1a8cff]/20 border-[#3399ff] text-[#3399ff] font-semibold"
                                : "bg-[#222222] border-[#333333] text-[#cccccc] hover:border-[#555555]"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. API Keys Tab */}
            {activeTab === "keys" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">API Keys & Authentication</h3>
                  <p className="text-xs text-[#888888] mt-0.5">
                    Credentials are saved securely in your local user config.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Built-in Providers */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-[#3399ff] uppercase tracking-wider">
                      Core Drivers
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                        Google Gemini API Key
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showKeys["gemini"] ? "text" : "password"}
                          value={settings.gemini_api_key}
                          onChange={(e) =>
                            setSettings({ ...settings, gemini_api_key: e.target.value })
                          }
                          placeholder="AIzaSy..."
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleShowKey("gemini")}
                        >
                          {showKeys["gemini"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                        OpenAI API Key (or Local LLM)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showKeys["openai"] ? "text" : "password"}
                          value={settings.openai_api_key}
                          onChange={(e) =>
                            setSettings({ ...settings, openai_api_key: e.target.value })
                          }
                          placeholder="sk-..."
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleShowKey("openai")}
                        >
                          {showKeys["openai"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                        Google Translate API Key (Optional)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showKeys["google"] ? "text" : "password"}
                          value={settings.google_api_key}
                          onChange={(e) =>
                            setSettings({ ...settings, google_api_key: e.target.value })
                          }
                          placeholder="Cloud Translation API Key"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleShowKey("google")}
                        >
                          {showKeys["google"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
                        Chanomhub Token (Publishing)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showKeys["chanomhub"] ? "text" : "password"}
                          value={settings.chanomhub_token}
                          onChange={(e) =>
                            setSettings({ ...settings, chanomhub_token: e.target.value })
                          }
                          placeholder="JWT Token"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleShowKey("chanomhub")}
                        >
                          {showKeys["chanomhub"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic External Plugin Credentials */}
                  {customPlugins.length > 0 && (
                    <div className="border-t border-[#2e2e2e] pt-3 space-y-3">
                      <div className="text-xs font-semibold text-[#ffb74d] uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        External Plugins ({customPlugins.length})
                      </div>

                      {customPlugins.map((plugin) => (
                        <div key={plugin.name} className="p-3 bg-[#202020] border border-[#2e2e2e] rounded-md space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-white">
                              {plugin.display_name} API Key
                            </label>
                            <span className="text-[10px] text-[#ffb74d] font-mono">
                              plugin: {plugin.name}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type={showKeys[plugin.name] ? "text" : "password"}
                              value={
                                settings.plugin_keys?.[plugin.name] ||
                                (settings as any)[`${plugin.name}_api_key`] ||
                                ""
                              }
                              onChange={(e) => handlePluginKeyChange(plugin.name, e.target.value)}
                              placeholder={`Enter API Key for ${plugin.display_name}`}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleShowKey(plugin.name)}
                            >
                              {showKeys[plugin.name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                          {plugin.base_url && (
                            <div className="text-[11px] text-[#777] flex items-center gap-1">
                              <span>Default Endpoint:</span>
                              <code className="text-[#a0a0a0] bg-[#161616] px-1 py-0.5 rounded">{plugin.base_url}</code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Plugins Tab */}
            {activeTab === "plugins" && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-white">External Provider Plugins</h3>
                    <p className="text-xs text-[#888888] mt-0.5">
                      Auto-discovered declarative plugins from <code>providers/</code> and <code>~/.config/nst/providers/</code>.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshPlugins}
                    disabled={isRefreshingPlugins}
                    className="h-7 text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPlugins ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="space-y-2 pt-1">
                  {customPlugins.length === 0 ? (
                    <div className="p-4 bg-[#202020] border border-[#2e2e2e] rounded-md text-xs text-[#888888] text-center">
                      No external JSON plugins currently detected.
                    </div>
                  ) : (
                    customPlugins.map((cp) => (
                      <div key={cp.name} className="p-3 bg-[#222222] border border-[#2e2e2e] rounded-md space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-xs text-white">{cp.display_name}</span>
                            <span className="ml-2 text-[10px] text-[#888888] font-mono">({cp.name})</span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3e2723] text-[#ffb74d] rounded">
                            REGISTERED
                          </span>
                        </div>
                        <p className="text-[11px] text-[#999]">
                          {cp.description || "Declarative external provider"}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[11px] text-[#777] pt-1">
                          {cp.base_url && (
                            <div>Endpoint: <code className="text-[#bbb]">{cp.base_url}</code></div>
                          )}
                          {cp.default_model && (
                            <div>Default: <code className="text-[#3399ff]">{cp.default_model}</code></div>
                          )}
                        </div>
                        {cp.available_models && cp.available_models.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {cp.available_models.map((m) => (
                              <span key={m} className="px-1.5 py-0.5 rounded text-[10px] bg-[#1a1a1a] text-[#aaa] border border-[#333]">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="text-xs text-[#777] bg-[#141414] p-3 rounded border border-[#2a2a2a] mt-3">
                  💡 Drop any new <code>.json</code> provider definition in <code>providers/</code> or <code>~/.config/nst/providers/</code> to expand translation models dynamically without rebuilding the app.
                </div>
              </div>
            )}

            {/* 5. Translation Tab */}
            {activeTab === "translation" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Translation Pipeline Defaults</h3>
                  <p className="text-xs text-[#888888] mt-0.5">
                    Configure default languages, batch sizing, and concurrency.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
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
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
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
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
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
                      <label className="block text-xs font-semibold text-[#a0a0a0] mb-1">
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
            )}

            {/* 6. About Tab */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-[#2b2b2b] pb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a8cff] to-[#0055b3] flex items-center justify-center font-bold text-xl text-white shadow-lg">
                    NST
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">NST Ghost - Novelty Translation Tool</h2>
                    <p className="text-xs text-[#888888]">Version 2.1.0 (Go Edition)</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#a0a0a0] leading-relaxed">
                  <p>
                    Modern, high-performance visual novel and game translation suite.
                    Designed for fast scanning, parallel AI translation pipelines, and zero-dependency packaging.
                  </p>
                  <div className="p-3 bg-[#222222] rounded-md border border-[#2e2e2e] space-y-1">
                    <div className="text-white font-semibold">Engine Features:</div>
                    <div>• Supported Engines: RPG Maker (MV/MZ), Tyrano, Wolf RPG, BGI / Ethornell, Ren&apos;Py</div>
                    <div>• AI Architecture: Parallel chunk batching with context preservation & glossary injection</div>
                    <div>• Plugin System: External JSON provider drivers with OpenAI-compatible routing</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 bg-[#141414] border-t border-[#2b2b2b] flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-[#1a8cff] hover:bg-[#0073e6] text-white"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
