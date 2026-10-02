/**
 * theme.js — Dark / light mode toggle
 *
 * Strategy:
 * 1. On page load, read saved preference from localStorage.
 *    If none saved, fall back to the OS preference via prefers-color-scheme.
 * 2. Apply the theme by setting data-theme on <html>.
 * 3. On toggle button click, flip the theme and persist the choice.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'phantomqr-theme';
  var DARK        = 'dark';
  var LIGHT       = 'light';

  /**
   * Returns the initial theme: saved preference → OS preference → light.
   * @returns {'dark'|'light'}
   */
  function getInitialTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (saved === DARK || saved === LIGHT) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return DARK;
    }
    return LIGHT;
  }

  /**
   * Apply a theme by writing data-theme to <html>.
   * @param {'dark'|'light'} theme
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}

    // Update aria-label on the toggle button if it already exists in DOM
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Apply before first paint to avoid flash of wrong theme
  applyTheme(getInitialTheme());

  // Wire up the toggle button once DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === DARK ? LIGHT : DARK);
    });

    // Listen for OS-level theme changes and update if the user hasn't
    // manually overridden their preference in this session.
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
        // Only follow OS changes if the user hasn't made a manual choice
        if (!saved) {
          applyTheme(e.matches ? DARK : LIGHT);
        }
      });
    }
  });
}());
