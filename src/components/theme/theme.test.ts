import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeScript } from "./ThemeScript";
import { THEME_STORAGE_KEY } from "./theme";

GlobalRegistrator.register({ url: "http://localhost:3000" });

type ChangeListener = (event: MediaQueryListEvent) => void;

let systemDark = false;
let mediaListeners = new Set<ChangeListener>();
let storageThrowsOnGet = false;
let storageThrowsOnSet = false;
let setItemCalls = 0;

const nativeLocalStorage = window.localStorage;

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        if (storageThrowsOnGet) throw new Error("Storage denied");
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        setItemCalls += 1;
        if (storageThrowsOnSet) throw new Error("Storage denied");
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  });
  return values;
}

function setSystemTheme(dark: boolean) {
  systemDark = dark;
}

function dispatchSystemChange(dark: boolean) {
  systemDark = dark;
  const unsubscribe = theme.subscribeTheme(() => {});
  const event = { matches: dark } as MediaQueryListEvent;
  for (const listener of mediaListeners) listener(event);
  unsubscribe();
}

function dispatchStorage(value: string | null, key: string | null = THEME_STORAGE_KEY) {
  const unsubscribe = theme.subscribeTheme(() => {});
  window.dispatchEvent(new StorageEvent("storage", {
    key,
    newValue: value,
    storageArea: window.localStorage as Storage,
  }));
  unsubscribe();
}

function runThemeScript() {
  const markup = renderToStaticMarkup(createElement(ThemeScript));
  const source = markup.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!source) throw new Error("ThemeScript did not render a script");
  Function(source)();
}

function setThemeMeta(...contents: string[]) {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((element) => element.remove());
  for (const content of contents) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = content;
    document.head.append(meta);
  }
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      media: query,
      get matches() { return systemDark; },
      onchange: null,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === "change" && typeof listener === "function") mediaListeners.add(listener as ChangeListener);
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === "change" && typeof listener === "function") mediaListeners.delete(listener as ChangeListener);
      },
      addListener(listener: ChangeListener) { mediaListeners.add(listener); },
      removeListener(listener: ChangeListener) { mediaListeners.delete(listener); },
      dispatchEvent() { return true; },
    }),
  });
});

const theme = await import("./theme");

async function loadFreshThemeModule() {
  return import(`./theme?startup=${crypto.randomUUID()}`);
}

beforeAll(() => {
  installStorage();
  setThemeMeta("#fafaf9");
});

afterEach(() => {
  storageThrowsOnGet = false;
  storageThrowsOnSet = false;
  setItemCalls = 0;
  mediaListeners = new Set();
  installStorage();
  dispatchStorage(null);
  setThemeMeta("#fafaf9");
});

afterAll(async () => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: nativeLocalStorage });
  await GlobalRegistrator.unregister();
});

describe("theme preference store", () => {
  test("resolves no preference with a light system theme", () => {
    setSystemTheme(false);

    expect(theme.getThemeSnapshot()).toEqual({ theme: "light", source: "system" });
  });

  test("resolves no preference with a dark system theme", () => {
    setSystemTheme(true);
    dispatchStorage(null);

    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
  });

  test("uses a valid saved preference before the system preference", () => {
    setSystemTheme(true);
    dispatchStorage("light");

    expect(theme.getThemeSnapshot()).toEqual({ theme: "light", source: "stored" });
  });

  test("resolves a persisted preference during initial store startup", async () => {
    setSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const freshTheme = await loadFreshThemeModule();

    expect(freshTheme.getThemeSnapshot()).toEqual({ theme: "light", source: "stored" });
  });

  test("treats localStorage.clear cross-tab events as explicit preference removal", () => {
    setSystemTheme(true);
    dispatchStorage("light");
    setItemCalls = 0;

    dispatchStorage(null, null);

    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
    expect(setItemCalls).toBe(0);
  });

  test("runs the rendered pre-paint script with stored and system resolution before application startup", () => {
    setSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    setThemeMeta("#111111", "#222222");

    runThemeScript();

    expect(document.documentElement.dataset.theme).toBe("light");
    const metas = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]?.getAttribute("data-sisyphus-theme-color")).toBe("");
    expect(metas[0]?.getAttribute("content")).toBe("#fafaf9");

    window.localStorage.removeItem(THEME_STORAGE_KEY);
    runThemeScript();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe("#1c1917");
  });

  test("ignores invalid and inaccessible saved preferences", () => {
    setSystemTheme(true);
    dispatchStorage("sepia");
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });

    storageThrowsOnGet = true;
    dispatchStorage(null);
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
  });

  test("toggles eagerly and updates one normalized browser theme-color meta element", () => {
    setSystemTheme(false);
    setThemeMeta("#111111", "#222222");
    dispatchStorage(null);

    theme.toggleTheme();

    expect(document.documentElement.dataset.theme).toBe("dark");
    const metas = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]?.getAttribute("data-sisyphus-theme-color")).toBe("");
    expect(metas[0]?.getAttribute("content")).toBe("#1c1917");
  });

  test("keeps a failed-write toggle as a session override despite later system changes", () => {
    setSystemTheme(false);
    dispatchStorage(null);
    storageThrowsOnSet = true;

    theme.toggleTheme();
    dispatchSystemChange(false);

    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "session" });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  test("notifies same-tab subscribers after a toggle", () => {
    setSystemTheme(false);
    dispatchStorage(null);
    let notifications = 0;
    const unsubscribe = theme.subscribeTheme(() => { notifications += 1; });

    theme.toggleTheme();

    expect(notifications).toBe(1);
    unsubscribe();
  });

  test("applies valid cross-tab choices and returns to system for removal or invalid values without writes", () => {
    setSystemTheme(true);
    dispatchStorage(null);
    setItemCalls = 0;

    dispatchStorage("light");
    expect(theme.getThemeSnapshot()).toEqual({ theme: "light", source: "stored" });
    dispatchStorage(null);
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
    dispatchStorage("invalid");
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
    expect(setItemCalls).toBe(0);
  });

  test("reacts to system changes only while system is the preference source", () => {
    setSystemTheme(false);
    dispatchStorage(null);
    const unsubscribe = theme.subscribeTheme(() => {});

    dispatchSystemChange(true);
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "system" });
    dispatchStorage("light");
    dispatchSystemChange(true);
    expect(theme.getThemeSnapshot()).toEqual({ theme: "light", source: "stored" });
    storageThrowsOnSet = true;
    theme.toggleTheme();
    dispatchSystemChange(false);
    expect(theme.getThemeSnapshot()).toEqual({ theme: "dark", source: "session" });

    unsubscribe();
  });

  test("keeps Strict Mode subscriptions idempotent and removes global listeners after final cleanup", () => {
    setSystemTheme(false);
    dispatchStorage(null);
    let calls = 0;
    const listener = () => { calls += 1; };
    const first = theme.subscribeTheme(listener);
    const second = theme.subscribeTheme(listener);

    dispatchSystemChange(true);
    expect(calls).toBe(1);
    first();
    second();
    expect(mediaListeners.size).toBe(0);
  });
});
