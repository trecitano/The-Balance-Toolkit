// Concept-page chrome: the element labels (e.g. "3B") and a small bar to move between concepts.
(() => {
  const n = Number(document.body.dataset.concept);
  const total = 10;
  const pad = (v) => String(v).padStart(2, '0');
  const files = ['01-instrument', '02-arcade', '03-protocol', '04-editorial', '05-pocket', '06-terminal', '07-unboxing', '08-flamingo', '09-poster', '10-two-boards'];

  document.querySelectorAll('[data-pick]').forEach((el) => {
    const tag = document.createElement('span');
    tag.className = 'pick-tag';
    tag.textContent = el.dataset.pick;
    tag.title = el.dataset.pickName || '';
    tag.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.prepend(tag);
  });

  const bar = document.createElement('nav');
  bar.className = 'kit-bar';
  bar.setAttribute('aria-label', 'Concepts');
  const prev = files[(n + total - 2) % total], next = files[n % total];
  bar.innerHTML = `<a href="index.html">All concepts</a><a href="${prev}.html" aria-label="Previous concept">‹</a><span>${pad(n)} / ${total}</span><a href="${next}.html" aria-label="Next concept">›</a><button type="button" aria-pressed="true">Labels</button>`;
  document.body.append(bar);
  const btn = bar.querySelector('button');
  const set = (on) => { document.documentElement.classList.toggle('no-picks', !on); btn.setAttribute('aria-pressed', on); };
  try { if (localStorage.getItem('tbt-labels') === 'off') set(false); } catch {}
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    set(on);
    try { localStorage.setItem('tbt-labels', on ? 'on' : 'off'); } catch {}
  });
  // Inside the gallery's previews the bar and labels would only be clutter.
  if (window.self !== window.top) document.documentElement.classList.add('in-frame');
})();
