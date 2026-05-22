// Minimal ambient declaration for the surface used by /extension-handoff.
// Only declares chrome.runtime.sendMessage / chrome.runtime.lastError; not
// pulling in @types/chrome since this is the only thing we touch from a
// web page context.

interface ChromeRuntimeLastError {
  message?: string;
}

interface ChromeRuntime {
  sendMessage(
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ): void;
  lastError?: ChromeRuntimeLastError;
}

interface ChromeGlobal {
  runtime?: ChromeRuntime;
}

declare const chrome: ChromeGlobal | undefined;
