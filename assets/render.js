// Renders the Markdown file named in <main data-md="..."> into that element,
// and pulls the "brand" (frontmatter `brand:`) + name (first "# H1") from a
// brand source file so Markdown stays the single source of truth for both the
// prose AND the site's identity. Edit content/*.md, never the HTML shells.
//
// The brand source defaults to content/home.md (the alexlinyx site). A page
// can belong to a differently-branded section by setting
//   <body data-brand-src="content/<section>.md">
// e.g. the BWS pages brand themselves from content/bws.md, so they read "bws"
// in the nav and titles and never link back to the alexlinyx home.
//
// Zero build: this runs in the browser using the vendored marked.min.js.
// The same .md files are what an LLM reads directly over HTTP (see /llms.txt).
(function () {
  const HOME_SRC = 'content/home.md';
  const FALLBACK_NAME = 'Your Name';

  // ---- Light/dark toggle ----
  // A manual choice (persisted in localStorage) overrides the system
  // preference via [data-theme] on <html>; with no choice saved, the
  // stylesheet follows prefers-color-scheme.
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  const currentTheme = () =>
    root.getAttribute('data-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const nav = document.querySelector('.site-nav');
  if (nav) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    const paint = () => {
      const dark = currentTheme() === 'dark';
      btn.textContent = dark ? '☀' : '☾';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    };
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      paint();
    });
    paint();
    nav.appendChild(btn);
  }

  const mount = document.querySelector('main[data-md]');
  const src = mount ? mount.getAttribute('data-md') : null;

  // Where this page gets its brand/identity from (defaults to the home page).
  const brandSrc = document.body.getAttribute('data-brand-src') || HOME_SRC;
  const isSection = brandSrc !== HOME_SRC; // a self-branded section (e.g. BWS)

  const fetchText = (url) =>
    fetch(url, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    });

  // Split leading "--- ... ---" YAML-ish frontmatter off the top of a file.
  // Returns { data: {key: value}, body }. Only simple `key: value` lines.
  const parseFrontmatter = (markdown) => {
    const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { data: {}, body: markdown };
    const data = {};
    m[1].split(/\r?\n/).forEach((line) => {
      if (/^\s*#/.test(line)) return; // allow # comments in frontmatter
      const i = line.indexOf(':');
      if (i > 0) {
        const key = line.slice(0, i).trim();
        const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        if (key) data[key] = val;
      }
    });
    return { data, body: markdown.slice(m[0].length) };
  };

  // The person's name is the first "# H1" in the body.
  const firstH1 = (markdown) => {
    const m = markdown.match(/^#\s+(.+?)\s*$/m);
    return m ? m[1].trim() : '';
  };

  // Fetch the current page's Markdown (if any) and the brand source.
  // When the page IS the brand source, don't fetch it twice.
  const pageMd = src ? fetchText(src) : Promise.resolve('');
  const isHome = !!src && src.endsWith('home.md');
  const brandMd = src && src === brandSrc ? pageMd : fetchText(brandSrc).catch(() => '');

  marked.setOptions({ gfm: true, breaks: false });

  Promise.all([pageMd, brandMd])
    .then(([pageRaw, brandRaw]) => {
      const bctx = parseFrontmatter(brandRaw);
      const brandName = firstH1(bctx.body) || FALLBACK_NAME; // e.g. "Alex Y. Lin"
      const brand = bctx.data.brand || brandName; // e.g. "alexlinyx" / "bws"
      // Titles: a self-branded section uses its brand; the personal site keeps
      // the person's name.
      const titleName = isSection ? brand : brandName;
      window.SITE_BRAND = brand;
      if (!isSection) window.SITE_NAME = brandName;

      // Site brand in the nav on every page.
      document.querySelectorAll('.brand').forEach((el) => {
        el.textContent = brand;
      });

      // Render the page body (minus any frontmatter) and set the title.
      if (mount) {
        mount.innerHTML = marked.parse(parseFrontmatter(pageRaw).body);

        // Open external links in a new tab (keeps Markdown links clean —
        // no need for raw <a target="_blank"> in the content files).
        mount.querySelectorAll('a[href]').forEach((a) => {
          if (/^https?:\/\//i.test(a.getAttribute('href')) && a.host !== location.host) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
        });

        if (isHome) {
          document.title = `${titleName} · Personal Knowledge Base`;
        } else {
          const h1 = mount.querySelector('h1');
          if (h1) document.title = `${h1.textContent} · ${titleName}`;
        }
      }
    })
    .catch((err) => {
      if (mount) {
        mount.innerHTML =
          `<p class="error">Couldn't load content (${err.message}). ` +
          `You can read it directly: <a href="${src}">${src}</a></p>`;
      }
    });
})();
