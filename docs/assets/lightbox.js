/**
 * TennoTools Profile Check - docs lightbox.
 *
 * Every screenshot in a `figure.shot` becomes clickable and opens larger in an
 * overlay on the same page: caption, counter and arrow navigation, close with
 * Escape / the close button / a click anywhere. Vanilla JS, no dependencies,
 * no external requests, works on file://. Without JavaScript nothing changes.
 */
(() => {
  const shots = [];
  for (const figure of document.querySelectorAll('figure.shot')) {
    const img = figure.querySelector('img');
    if (!img) continue;
    const caption = figure.querySelector('figcaption');
    shots.push({
      figure,
      img,
      label: img.alt || 'screenshot',
      caption: (caption?.textContent ?? img.alt ?? '').replace(/\s+/g, ' ').trim(),
    });
  }
  if (shots.length === 0) return;

  // --- overlay skeleton, created once ---------------------------------------
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Screenshot viewer');
  overlay.innerHTML = `
    <div class="lb-top">
      <span class="lb-count"></span>
      <button type="button" class="lb-close" aria-label="Close (Escape)">&times;</button>
    </div>
    <button type="button" class="lb-prev" aria-label="Previous screenshot (left arrow)">&#8249;</button>
    <figure class="lb-stage">
      <img class="lb-image" alt="" />
      <figcaption class="lb-caption"></figcaption>
    </figure>
    <button type="button" class="lb-next" aria-label="Next screenshot (right arrow)">&#8250;</button>
  `;
  document.body.append(overlay);

  const image = overlay.querySelector('.lb-image');
  const caption = overlay.querySelector('.lb-caption');
  const counter = overlay.querySelector('.lb-count');
  const previous = overlay.querySelector('.lb-prev');
  const next = overlay.querySelector('.lb-next');
  const closeButton = overlay.querySelector('.lb-close');

  let current = 0;
  let restoreFocus = null;
  let closeTimer = 0;

  function show(index) {
    current = (index + shots.length) % shots.length;
    const shot = shots[current];
    image.src = shot.img.currentSrc || shot.img.src;
    image.alt = shot.img.alt || '';
    caption.textContent = shot.caption;
    counter.textContent = `${current + 1} / ${shots.length}`;
    overlay.classList.toggle('single', shots.length === 1);
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(current - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + 1);
      return;
    }
    if (event.key === 'Tab') {
      // Keep Tab inside the overlay: close / previous / next.
      const order = [closeButton, previous, next];
      const from = order.indexOf(document.activeElement);
      event.preventDefault();
      if (from === -1) {
        (event.shiftKey ? order.at(-1) : order[0]).focus();
        return;
      }
      order[(from + (event.shiftKey ? order.length - 1 : 1)) % order.length].focus();
    }
  }

  function open(index, trigger) {
    clearTimeout(closeTimer);
    restoreFocus = trigger;
    show(index);
    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => overlay.classList.add('open'));
    closeButton.focus();
  }

  function close() {
    if (overlay.hidden) return;
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
    document.body.classList.remove('lightbox-open');
    closeTimer = setTimeout(() => {
      overlay.hidden = true;
    }, 160);
    restoreFocus?.focus?.();
    restoreFocus = null;
  }

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('.lb-prev')) {
      show(current - 1);
    } else if (event.target.closest('.lb-next')) {
      show(current + 1);
    } else {
      close();
    }
  });

  // Make the thumbnails clickable (keyboard included). No JS -> no change.
  shots.forEach((shot, index) => {
    shot.figure.classList.add('zoomable');
    shot.img.tabIndex = 0;
    shot.img.setAttribute('role', 'button');
    shot.img.setAttribute('aria-label', `Enlarge: ${shot.label}`);
    shot.img.addEventListener('click', () => open(index, shot.img));
    shot.img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(index, shot.img);
      }
    });
  });
})();
