import { useCallback, useEffect, useMemo, useState } from "react";
import { PROVIDER_CONFIGS, type ThemeAppearance } from "@agentide/shared";
import {
  Button,
  ChevronDownIcon,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@agentide/ui";
import {
  IconAdjustments,
  IconKey,
  IconPlugConnected,
} from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import {
  applyResolvedTheme,
  resolveAppearance,
  setStoredAppearance,
} from "@/lib/document-theme";
import { useChatEditorStore } from "@/store/editor";
import { MCPSettings } from "./mcp-settings";
import { ProviderKeyInput } from "./providerkey";

type SettingsSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group?: string;
};

const SECTIONS: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    icon: <IconAdjustments className="size-4" />,
    group: "App",
  },
  {
    id: "providers",
    label: "Providers",
    icon: <IconKey className="size-4" />,
    group: "App",
  },
  {
    id: "mcp",
    label: "MCP Servers",
    icon: <IconPlugConnected className="size-4" />,
    group: "Integrations",
  },
];

type ApiKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export const ApiKeyDialog = ({
  open,
  onOpenChange,
  onSaved,
}: ApiKeyDialogProps) => {
  const [activeSection, setActiveSection] = useState<string>("general");
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string | null>>({});
  const [commitMessageModel, setCommitMessageModel] = useState("");
  const [commitMessageProvider, setCommitMessageProvider] = useState<string>("");
  const [appearance, setAppearance] = useState<ThemeAppearance>("dark");

  const api = getElectronAPI();
  const modelOptions = useChatEditorStore((s) => s.modelOptions);
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);
  const commitMessageModelOptions = useMemo(
    () =>
      modelOptions.map((option) => ({
        value: option.value,
        label: option.label,
        provider: option.provider,
      })),
    [modelOptions]
  );

  const refreshMaskedKeys = useCallback(async () => {
    if (!api?.apiKeys) return;
    const providers = PROVIDER_CONFIGS.map((p) => p.id);
    const results = await Promise.all(
      providers.map((provider) => api.apiKeys!.get(provider))
    );
    const newMasked: Record<string, string | null> = {};
    results.forEach((res, i) => {
      if (res?.success && res.data) {
        const key = res.data;
        newMasked[providers[i]] = `${key.slice(0, 7)}${"•".repeat(20)}${key.slice(-4)}`;
      } else {
        newMasked[providers[i]] = null;
      }
    });
    setMaskedKeys(newMasked);
  }, [api]);

  useEffect(() => {
    if (!open) return;
    refreshMaskedKeys();
    void fetchModelOptions();
  }, [fetchModelOptions, open, refreshMaskedKeys]);

  useEffect(() => {
    if (!open || !api?.settings) return;
    let cancelled = false;
    void api.settings.get().then((result) => {
      if (!result.success || !result.data || cancelled) return;
      setCommitMessageModel(result.data.commitMessageModel ?? "");
      setCommitMessageProvider(result.data.commitMessageProvider ?? "");
      setAppearance(result.data.appearance ?? "dark");
    });
    return () => {
      cancelled = true;
    };
  }, [api, open]);

  const handleCommitMessageModelChange = useCallback(
    async (value: string) => {
      if (!api?.settings) return;
      const selected = commitMessageModelOptions.find((o) => o.value === value);
      const nextModel = value === "__default__" ? "" : value;
      const nextProvider = value === "__default__" ? "" : (selected?.provider ?? "");
      setCommitMessageModel(nextModel);
      setCommitMessageProvider(nextProvider);
      const current = await api.settings.get();
      if (!current.success || !current.data) return;
      await api.settings.set({
        ...current.data,
        commitMessageModel: nextModel || undefined,
        commitMessageProvider: nextProvider || undefined,
      });
      onSaved?.();
    },
    [api, commitMessageModelOptions, onSaved]
  );

  const handleAppearanceChange = useCallback(
    async (value: string) => {
      if (value !== "light" && value !== "dark" && value !== "system") return;
      const next = value as ThemeAppearance;
      setAppearance(next);
      setStoredAppearance(next);
      applyResolvedTheme(resolveAppearance(next));
      if (!api?.settings) return;
      const current = await api.settings.get();
      if (!current.success || !current.data) return;
      await api.settings.set({ ...current.data, appearance: next });
      onSaved?.();
    },
    [api, onSaved]
  );

  const groups = Array.from(new Set(SECTIONS.map((s) => s.group).filter(Boolean)));

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-4xl h-[680px] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar nav */}
          <aside className="w-48 shrink-0 border-r border-border/40 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Settings</span>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
              {groups.map((group) => (
                <div key={group}>
                  <div className="px-1.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {group}
                    </span>
                  </div>
                  <div className="space-y-px">
                    {SECTIONS.filter((s) => s.group === group).map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={[
                          "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                          activeSection === section.id
                            ? "text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className={`shrink-0 ${activeSection === section.id ? "opacity-80" : "opacity-40"}`}>
                          {section.icon}
                        </span>
                        {section.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Right content panel */}
          <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            {activeSection === "general" && (
              <GeneralSettingsSection
                appearance={appearance}
                commitMessageModel={commitMessageModel}
                commitMessageModelOptions={commitMessageModelOptions}
                onAppearanceChange={(v) => void handleAppearanceChange(v)}
                onCommitMessageModelChange={(v) =>
                  void handleCommitMessageModelChange(v)
                }
              />
            )}

            {activeSection === "providers" && (
              <ProviderSettingsSection
                maskedKeys={maskedKeys}
                onSaved={() => {
                  void refreshMaskedKeys();
                  onSaved?.();
                }}
              />
            )}

            {activeSection === "mcp" && (
              <div className="flex-1 min-h-0 overflow-hidden p-5">
                <MCPSettings />
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------------------------------------------------------------- */
/* Section components                                                           */
/* -------------------------------------------------------------------------- */

type GeneralSettingsSectionProps = {
  appearance: ThemeAppearance;
  commitMessageModel: string;
  commitMessageModelOptions: { value: string; label: string; provider: string }[];
  onAppearanceChange: (value: string) => void;
  onCommitMessageModelChange: (value: string) => void;
};

function GeneralSettingsSection({
  appearance,
  commitMessageModel,
  commitMessageModelOptions,
  onAppearanceChange,
  onCommitMessageModelChange,
}: GeneralSettingsSectionProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader
        title="General"
        description="App-wide preferences and defaults."
      />
      <div className="flex-1 px-6 pb-6">
        <SettingsRow
          label="Appearance"
          description="Light, dark, or match your system setting."
        >
          <DropdownMenu modal={true}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="w-[180px] justify-between font-normal">
                <span className="truncate text-sm">
                  {appearance === "system"
                    ? "System"
                    : appearance === "light"
                      ? "Light"
                      : "Dark"}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuRadioGroup
                value={appearance}
                onValueChange={onAppearanceChange}
              >
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsRow>

        <SettingsRow
          label="Commit message model"
          description="Which model generates short git commit messages from staged diffs."
        >
          <DropdownMenu modal={true}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="w-[220px] justify-between font-normal">
                <span className="truncate text-sm">
                  {commitMessageModel
                    ? (commitMessageModelOptions.find(
                        (o) => o.value === commitMessageModel
                      )?.label ?? commitMessageModel)
                    : "Use default model"}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuRadioGroup
                value={commitMessageModel || "__default__"}
                onValueChange={onCommitMessageModelChange}
              >
                <DropdownMenuRadioItem value="__default__">
                  Use default model
                </DropdownMenuRadioItem>
                {commitMessageModelOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsRow>
      </div>
    </div>
  );
}

type ProviderSettingsSectionProps = {
  maskedKeys: Record<string, string | null>;
  onSaved: () => void;
};

function ProviderSettingsSection({ maskedKeys, onSaved }: ProviderSettingsSectionProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Providers"
        description="API keys are encrypted and stored locally — they never leave your machine."
      />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {PROVIDER_CONFIGS.map((provider) => (
          <ProviderKeyInput
            key={provider.id}
            config={provider}
            maskedKey={maskedKeys[provider.id] ?? null}
            onSaved={onSaved}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                            */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-border/30">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/30 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
