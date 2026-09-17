import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from "react";
import { CommandRegistry, defaultCommandRegistry } from "./registry";
import type { Command, CommandScope } from "./types";

interface CommandContextValue {
  registry: CommandRegistry;
  activeScope: CommandScope;
  setActiveScope: (scope: CommandScope) => void;
  commands: Command[];
}

const CommandContext = createContext<CommandContextValue | null>(null);

interface CommandProviderProps {
  children: React.ReactNode;
  registry?: CommandRegistry;
  defaultScope?: CommandScope;
}

export const CommandProvider: React.FC<CommandProviderProps> = ({
  children,
  registry = defaultCommandRegistry,
  defaultScope = "global",
}) => {
  const [activeScope, setActiveScope] = useState<CommandScope>(defaultScope);
  const [commands, setCommands] = useState<Command[]>(() => registry.getAll());
  const activeScopeRef = useRef(activeScope);

  useEffect(() => {
    activeScopeRef.current = activeScope;
  }, [activeScope]);

  // Subscribe to registry updates (for reactive lists/Command Palette)
  useEffect(() => {
    return registry.subscribe(() => {
      setCommands(registry.getAll());
    });
  }, [registry]);

  // Single global keydown listener at the application root
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      registry.handleKeyEvent(e, activeScopeRef.current);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [registry]);

  const value = useMemo(
    () => ({
      registry,
      activeScope,
      setActiveScope,
      commands,
    }),
    [registry, activeScope, commands]
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
};

/**
 * Access the global command registry and active scope.
 */
export function useCommandRegistry(): CommandContextValue {
  const ctx = useContext(CommandContext);
  if (!ctx) {
    // Graceful fallback for isolated unit tests or components rendered outside CommandProvider
    return {
      registry: defaultCommandRegistry,
      activeScope: "global",
      setActiveScope: () => {},
      commands: defaultCommandRegistry.getAll(),
    };
  }
  return ctx;
}

/**
 * Hook to register commands on component mount and automatically unregister on unmount.
 * Supports reactive handler updates via dependency array or refs.
 */
export function useCommands(commands: Command[], deps: React.DependencyList = []): void {
  const { registry } = useCommandRegistry();

  useEffect(() => {
    const unregister = registry.registerMany(commands);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, ...deps]);
}

/**
 * Hook to set the active command scope for the lifetime of the component.
 * Automatically restores previous scope when the component unmounts.
 */
export function useActiveScope(scope: CommandScope): void {
  const { setActiveScope, activeScope } = useCommandRegistry();

  useEffect(() => {
    const prevScope = activeScope;
    setActiveScope(scope);
    return () => {
      setActiveScope(prevScope);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
}
