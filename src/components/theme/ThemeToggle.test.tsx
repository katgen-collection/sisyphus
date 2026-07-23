import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

GlobalRegistrator.register({ url: "http://localhost:3000" });

let theme = "light" as "light" | "dark";
const snapshots = {
  light: { theme: "light" as const, source: "stored" as const },
  dark: { theme: "dark" as const, source: "stored" as const },
};
const serverSnapshot = { theme: "light" as const, source: "system" as const };
const toggleTheme = mock(() => {
  theme = theme === "light" ? "dark" : "light";
});

mock.module("./theme", () => ({
  getThemeSnapshot: () => snapshots[theme],
  getServerThemeSnapshot: () => serverSnapshot,
  subscribeTheme: () => () => {},
  toggleTheme,
}));

mock.module("next/navigation", () => ({
  usePathname: () => "/",
}));

mock.module("next/image", () => ({
  default: ({ priority: _priority, ...props }: Record<string, unknown>) => createElement("img", props),
}));

mock.module("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

const { ThemeToggle } = await import("./ThemeToggle");
const { Sidebar } = await import("../Sidebar");
const { PageHeader } = await import("../PageHeader");
const RootLayout = (await import("../../app/layout")).default;
const Home = (await import("../../app/page")).default;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

afterEach(() => {
  cleanup();
  theme = "light";
  toggleTheme.mockClear();
  window.localStorage.clear();
  document.documentElement.dataset.sidebar = "expanded";
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

describe("ThemeToggle", () => {
  test("shows the moon, dark-mode action label, and unpressed state in light mode", () => {
    const view = render(<ThemeToggle />);

    const button = view.getByRole("button", { name: "Switch to dark theme" });
    expect(button.getAttribute("role")).toBeNull();
    expect(button.getAttribute("aria-checked")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.className).toContain("text-secondary");
    expect(button.className).toContain("focus-visible:outline-focus");
    expect(view.getByText("Dark mode")).toBeTruthy();
    expect(button.querySelector("svg.lucide-moon")).toBeTruthy();
  });

  test("shows the sun, light-mode action label, and pressed state in dark mode", () => {
    theme = "dark";
    const view = render(<ThemeToggle />);

    const button = view.getByRole("button", { name: "Switch to light theme" });
    expect(button.getAttribute("role")).toBeNull();
    expect(button.getAttribute("aria-checked")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(view.getByText("Light mode")).toBeTruthy();
    expect(button.querySelector("svg.lucide-sun")).toBeTruthy();
  });

  test("toggles the theme when clicked", () => {
    const view = render(<ThemeToggle />);

    fireEvent.click(view.getByRole("button", { name: "Switch to dark theme" }));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  test("renders the expanded sidebar control with its icon and visible label", () => {
    const view = render(<Sidebar />);

    const button = view.getByRole("button", { name: "Switch to dark theme" });
    expect(view.getByText("Dark mode")).toBeTruthy();
    expect(button.querySelector("svg.lucide-moon")).toBeTruthy();
  });

  test("gives expanded sidebar footer controls matching 44-pixel targets and visible focus rings", () => {
    const view = render(<Sidebar />);
    const themeButton = view.getByRole("button", { name: "Switch to dark theme" });
    const collapseButton = view.getByRole("button", { name: "Collapse" });

    expect(themeButton.className).toContain("min-h-11");
    expect(collapseButton.className).toContain("min-h-11");
    expect(collapseButton.className).toContain("focus-visible:outline-focus");
  });

  test("gives collapsed sidebar footer controls matching 44-pixel targets and visible focus rings", () => {
    window.localStorage.setItem("sidebar-collapsed", "true");
    const view = render(<Sidebar />);
    const themeButton = view.getByRole("button", { name: "Switch to dark theme" });
    const collapseButton = view.getByRole("button", { name: "Expand sidebar" });

    expect(themeButton.className).toContain("min-h-11");
    expect(themeButton.className).toContain("min-w-11");
    expect(collapseButton.className).toContain("min-h-11");
    expect(collapseButton.className).toContain("min-w-11");
    expect(collapseButton.className).toContain("focus-visible:outline-focus");
  });

  test("renders the collapsed sidebar toggle icon-only with a tooltip without changing collapse state", () => {
    window.localStorage.setItem("sidebar-collapsed", "true");
    const view = render(<Sidebar />);

    const button = view.getByRole("button", { name: "Switch to dark theme" });
    expect(button.getAttribute("title")).toBe("Switch to dark theme");
    expect(button.textContent).toBe("");
    expect(document.documentElement.dataset.sidebar).toBe("collapsed");

    fireEvent.click(button);

    expect(toggleTheme).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.sidebar).toBe("collapsed");
  });

  test("places the mobile control beneath the fixed offline banner", () => {
    const markup = renderToStaticMarkup(createElement(RootLayout, { children: createElement("div") }));
    const mobileControl = markup.match(/<button[^>]*class="([^"]*fixed[^"]*)"[^>]*>/)?.[0];

    expect(mobileControl).toBeTruthy();
    expect(mobileControl).toContain("top-[calc(env(safe-area-inset-top)+3.5rem)]");
    expect(mobileControl).toContain("lg:hidden");
    expect(mobileControl).toContain("z-30");
    expect(mobileControl).not.toContain("z-100");
    expect(mobileControl).toContain("min-h-11 min-w-11");
  });

  test("reserves the mobile header and home hero corner for the fixed control", () => {
    const headerMarkup = renderToStaticMarkup(createElement(PageHeader, { title: "Video tools" }));
    const homeMarkup = renderToStaticMarkup(createElement(Home));

    expect(headerMarkup).toContain("pr-16");
    expect(headerMarkup).toContain("lg:pr-6");
    expect(homeMarkup).toContain("pr-20");
    expect(homeMarkup).toContain("lg:pr-6");
  });
});
