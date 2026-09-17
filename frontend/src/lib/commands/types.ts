export type CommandScope = "global" | "editor" | "projects" | "modal" | string;

export interface Command {
  /** Unique identifier e.g. 'file.open-game', 'editor.find' */
  id: string;
  /** Human-readable title for UI and Command Palette */
  title: string;
  /** Category grouping e.g. 'File', 'Editor', 'Translation' */
  category?: string;
  /** Optional extended description */
  description?: string;
  /**
   * Keyboard shortcut representation e.g.
   * 'Ctrl+F', 'Ctrl+Shift+O', 'Ctrl+,', 'Ctrl+Enter', 'Escape'
   */
  keybinding?: string;
  /**
   * Execution scope.
   * 'global' commands are active application-wide.
   * Scoped commands (e.g. 'editor') are only active when that scope is active.
   * Default is 'global'.
   */
  scope?: CommandScope;
  /**
   * Optional condition function.
   * Command only executes if when() evaluates to true.
   */
  when?: () => boolean;
  /**
   * If true (default for letter keys), shortcut is ignored when an <input>
   * or <textarea> has focus (unless it's a specific modifier action like Ctrl+Enter).
   */
  preventInInput?: boolean;
  /** Function executed when the command or keybinding triggers */
  run: () => void | Promise<void>;
}

export interface ParsedKeybinding {
  raw: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  code: string;
  key: string;
}
