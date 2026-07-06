// Renders the Markdown file named in <main data-md="..."> into that element.
// Zero build: this runs in the browser using the vendored marked.min.js.
// The same .md files are what an LLM reads directly over HTTP (see /llms.txt),
// so Markdown stays the single source of truth for every page.
(function () {
  const mount = document.querySelector('main[data-md]');
  if (!mount) return;

  const src = mount.getAttribute('data-md');

  fetch(src, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    })
    .then((markdown) => {
      // marked is loaded globally from assets/marked.min.js
      marked.setOptions({ gfm: true, breaks: false });
      mount.innerHTML = marked.parse(markdown);

      // Use the first <h1> as the document title if the page didn't set one.
      const h1 = mount.querySelector('h1');
      if (h1 && document.title.startsWith('…')) {
        document.title = `${h1.textContent} · ${window.SITE_NAME || ''}`.trim();
      }
    })
    .catch((err) => {
      mount.innerHTML =
        `<p class="error">Couldn't load content (${err.message}). ` +
        `You can read it directly: <a href="${src}">${src}</a></p>`;
    });
})();
