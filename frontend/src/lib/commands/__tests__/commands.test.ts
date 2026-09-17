// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { parseKeybinding, matchesKeybinding } from "../normalizer";
import { CommandRegistry } from "../registry";

describe("Universal Keybinding Normalizer (W3C Hardware Code Standard)", () => {
  it("parses standard keybinding combinations", () => {
    const p1 = parseKeybinding("Ctrl+F");
    expect(p1.ctrl).toBe(true);
    expect(p1.shift).toBe(false);
    expect(p1.code).toBe("KeyF");

    const p2 = parseKeybinding("Ctrl+Shift+O");
    expect(p2.ctrl).toBe(true);
    expect(p2.shift).toBe(true);
    expect(p2.code).toBe("KeyO");

    const p3 = parseKeybinding("Ctrl+,");
    expect(p3.ctrl).toBe(true);
    expect(p3.code).toBe("Comma");

    const p4 = parseKeybinding("Escape");
    expect(p4.ctrl).toBe(false);
    expect(p4.code).toBe("Escape");
  });

  it("matches across any language on Earth via physical e.code without hardcoding", () => {
    const parsed = parseKeybinding("Ctrl+F");

    // English layout event
    const englishEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "f",
      ctrlKey: true,
    });
    expect(matchesKeybinding(englishEvent, parsed)).toBe(true);

    // Thai layout event (e.key is 'ด')
    const thaiEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "ด",
      ctrlKey: true,
    });
    expect(matchesKeybinding(thaiEvent, parsed)).toBe(true);

    // Russian layout event (e.key is 'а')
    const russianEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "а",
      ctrlKey: true,
    });
    expect(matchesKeybinding(russianEvent, parsed)).toBe(true);

    // Arabic layout event (e.key is 'ب')
    const arabicEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "ب",
      ctrlKey: true,
    });
    expect(matchesKeybinding(arabicEvent, parsed)).toBe(true);

    // Greek layout event (e.key is 'φ')
    const greekEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "φ",
      ctrlKey: true,
    });
    expect(matchesKeybinding(greekEvent, parsed)).toBe(true);
  });

  it("differentiates modifiers accurately", () => {
    const ctrlO = parseKeybinding("Ctrl+O");
    const ctrlShiftO = parseKeybinding("Ctrl+Shift+O");

    const eventWithoutShift = new KeyboardEvent("keydown", {
      code: "KeyO",
      key: "o",
      ctrlKey: true,
      shiftKey: false,
    });

    const eventWithShift = new KeyboardEvent("keydown", {
      code: "KeyO",
      key: "O",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(matchesKeybinding(eventWithoutShift, ctrlO)).toBe(true);
    expect(matchesKeybinding(eventWithoutShift, ctrlShiftO)).toBe(false);

    expect(matchesKeybinding(eventWithShift, ctrlO)).toBe(false);
    expect(matchesKeybinding(eventWithShift, ctrlShiftO)).toBe(true);
  });
});

describe("CommandRegistry Scoping & Execution", () => {
  it("executes commands and respects active scope", () => {
    const registry = new CommandRegistry();
    const globalFn = vi.fn();
    const editorFn = vi.fn();

    registry.register({
      id: "global.settings",
      title: "Settings",
      keybinding: "Ctrl+,",
      scope: "global",
      run: globalFn,
    });

    registry.register({
      id: "editor.find",
      title: "Find",
      keybinding: "Ctrl+F",
      scope: "editor",
      run: editorFn,
    });

    // When active scope is 'projects', editor.find should NOT execute
    const thaiFindEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "ด",
      ctrlKey: true,
    });
    registry.handleKeyEvent(thaiFindEvent, "projects");
    expect(editorFn).not.toHaveBeenCalled();

    // When active scope is 'editor', editor.find SHOULD execute
    registry.handleKeyEvent(thaiFindEvent, "editor");
    expect(editorFn).toHaveBeenCalledTimes(1);

    // Global settings works in any scope
    const settingsEvent = new KeyboardEvent("keydown", {
      code: "Comma",
      key: ",",
      ctrlKey: true,
    });
    registry.handleKeyEvent(settingsEvent, "projects");
    expect(globalFn).toHaveBeenCalledTimes(1);
  });

  it("respects when condition guard", () => {
    const registry = new CommandRegistry();
    const runFn = vi.fn();
    let canRun = false;

    registry.register({
      id: "conditional.cmd",
      title: "Conditional",
      keybinding: "Ctrl+T",
      when: () => canRun,
      run: runFn,
    });

    const event = new KeyboardEvent("keydown", {
      code: "KeyT",
      key: "t",
      ctrlKey: true,
    });

    registry.handleKeyEvent(event, "global");
    expect(runFn).not.toHaveBeenCalled();

    canRun = true;
    registry.handleKeyEvent(event, "global");
    expect(runFn).toHaveBeenCalledTimes(1);
  });

  it("suppresses letter shortcuts in editable input elements unless explicitly permitted", () => {
    const registry = new CommandRegistry();
    const findFn = vi.fn();
    const submitFn = vi.fn();

    registry.register({
      id: "editor.find",
      title: "Find",
      keybinding: "Ctrl+F",
      preventInInput: true,
      run: findFn,
    });

    registry.register({
      id: "editor.submit",
      title: "Submit",
      keybinding: "Ctrl+Enter",
      preventInInput: false,
      run: submitFn,
    });

    const input = document.createElement("input");
    document.body.appendChild(input);

    // Dispatched on input element
    const findEvent = new KeyboardEvent("keydown", {
      code: "KeyF",
      key: "f",
      ctrlKey: true,
    });
    Object.defineProperty(findEvent, "target", { value: input, writable: false });

    registry.handleKeyEvent(findEvent, "global");
    expect(findFn).not.toHaveBeenCalled();

    const submitEvent = new KeyboardEvent("keydown", {
      code: "Enter",
      key: "Enter",
      ctrlKey: true,
    });
    Object.defineProperty(submitEvent, "target", { value: input, writable: false });

    registry.handleKeyEvent(submitEvent, "global");
    expect(submitFn).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });
});
