// Dark mode is hidden from the UI. Force light on first paint so any stored
// 'dark' preference from before the toggle was hidden is ignored.
const themeInitScript = `
(function() {
  try {
    var root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme-pref', 'light');
  } catch (e) {}
})();
`.trim();

export function ThemeScript() {
  return (
    // eslint-disable-next-line react/no-danger
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  );
}
