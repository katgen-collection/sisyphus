export type Theme = "light" | "dark";
type ThemeSource = "stored" | "session" | "system";

export interface ThemeSnapshot {
  theme: Theme;
  source: ThemeSource;
}

export const THEME_STORAGE_KEY = "sisyphus-theme";
export const THEME_CHANGE_EVENT = "sisyphus-theme-change";

const DARK_THEME_COLOR = "#1c1917";
const LIGHT_THEME_COLOR = "#fafaf9";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const serverSnapshot: ThemeSnapshot = { theme: "light", source: "system" };

let snapshot = serverSnapshot;
let initialized = false;
let mediaQuery: MediaQueryList | undefined;
const listeners = new Map<() => void, number>();
let listening = false;

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readStoredTheme(): Theme | undefined {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function getThemeColor(theme: Theme): string {
  return theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
}

function getThemeColorMeta(): HTMLMetaElement {
  const elements = Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const primary = elements.find((element) => element.hasAttribute("data-sisyphus-theme-color")) ?? elements.shift() ?? document.createElement("meta");

  if (!primary.parentElement) {
    primary.name = "theme-color";
    document.head.append(primary);
  }
  primary.setAttribute("data-sisyphus-theme-color", "");
  for (const element of elements) {
    if (element !== primary) element.remove();
  }
  return primary;
}

function applySnapshot(next: ThemeSnapshot): void {
  snapshot = next;
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = next.theme;
  getThemeColorMeta().content = getThemeColor(next.theme);
}

function initialize(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const storedTheme = readStoredTheme();
  applySnapshot(storedTheme
    ? { theme: storedTheme, source: "stored" }
    : { theme: getSystemTheme(), source: "system" });
}

function notify(): void {
  for (const listener of listeners.keys()) listener();
}

function onThemeChange(): void {
  notify();
}

function onStorageChange(event: StorageEvent): void {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;

  initialize();
  const theme = isTheme(event.newValue) ? event.newValue : undefined;
  applySnapshot(theme
    ? { theme, source: "stored" }
    : { theme: getSystemTheme(), source: "system" });
  notify();
}

function onSystemChange(): void {
  if (snapshot.source !== "system") return;

  applySnapshot({ theme: getSystemTheme(), source: "system" });
  notify();
}

function addGlobalListeners(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  window.addEventListener("storage", onStorageChange);
  try {
    mediaQuery = window.matchMedia?.(DARK_MEDIA_QUERY);
    mediaQuery?.addEventListener("change", onSystemChange);
  } catch {
    mediaQuery = undefined;
  }
}

function removeGlobalListeners(): void {
  if (!listening || typeof window === "undefined") return;
  listening = false;
  window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  window.removeEventListener("storage", onStorageChange);
  mediaQuery?.removeEventListener("change", onSystemChange);
  mediaQuery = undefined;
}

export function getThemeSnapshot(): ThemeSnapshot {
  initialize();
  return snapshot;
}

export function getServerThemeSnapshot(): ThemeSnapshot {
  return serverSnapshot;
}

export function subscribeTheme(listener: () => void): () => void {
  initialize();
  listeners.set(listener, (listeners.get(listener) ?? 0) + 1);
  addGlobalListeners();

  return () => {
    const count = listeners.get(listener) ?? 0;
    if (count <= 1) listeners.delete(listener);
    else listeners.set(listener, count - 1);
    if (listeners.size === 0) removeGlobalListeners();
  };
}

export function toggleTheme(): void {
  initialize();
  const theme: Theme = snapshot.theme === "light" ? "dark" : "light";
  let source: ThemeSource = "stored";

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    source = "session";
  }

  applySnapshot({ theme, source });
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
