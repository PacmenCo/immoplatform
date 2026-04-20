// Inline script that runs before React hydrates, so dark mode is applied on
// first paint (no flash). Reads the stored preference, falls back to the OS
// preference, and sets data-theme on the <html> element.
//
// Safety: the script source is a hardcoded string constant with no user input,
// so dangerouslySetInnerHTML is safe here. It's the standard Next.js pattern
// for pre-hydration theme scripts (see next-themes, shadcn/ui, etc).
const themeInitScript = `
(function() {
  try {
    var pref = localStorage.getItem('theme-pref') || 'system';
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var effective = pref === 'dark' || pref === 'light' ? pref : sys;
    var root = document.documentElement;
    root.setAttribute('data-theme', effective);
    root.setAttribute('data-theme-pref', pref);
  } catch (e) {}
})();
`.trim();

export function ThemeScript() {
  return (
    // eslint-disable-next-line react/no-danger
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  );
}
