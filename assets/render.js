// Renders the Markdown file named in <main data-md="..."> into that element,
// and pulls two things out of content/home.md so the Markdown stays the single
// source of truth for the whole site:
//   * the site "brand" (frontmatter `brand:`) — shown in the nav on every page
//   * the person's name (first "# H1") — used to build page/tab titles
// Edit content/*.md, never the HTML shells.
//
// Zero build: this runs in the browser using the vendored marked.min.js.
// The same .md files are what an LLM reads directly over HTTP (see /llms.txt).
(function () {
  const HOME_SRC = 'content/home.md';
  const FALLBACK_NAME = 'Your Name';

  const mount = document.querySelector('main[data-md]');
  const src = mount ? mount.getAttribute('data-md') : null;

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

  // Fetch the current page's Markdown (if any) and home.md for brand + name.
  // On the home page these are the same file, so don't fetch it twice.
  const pageMd = src ? fetchText(src) : Promise.resolve('');
  const isHome = !!src && src.endsWith('home.md');
  const homeMd = isHome ? pageMd : fetchText(HOME_SRC).catch(() => '');

  marked.setOptions({ gfm: true, breaks: false });

  Promise.all([pageMd, homeMd])
    .then(([pageRaw, homeRaw]) => {
      const home = parseFrontmatter(homeRaw);
      const siteName = firstH1(home.body) || FALLBACK_NAME;
      const brand = home.data.brand || siteName;
      window.SITE_NAME = siteName;
      window.SITE_BRAND = brand;

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
          document.title = `${siteName} · Personal Knowledge Base`;
        } else {
          const h1 = mount.querySelector('h1');
          if (h1) document.title = `${h1.textContent} · ${siteName}`;
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
