export interface InjectableField {
  fieldKey: string;
  fieldType: string;
  label: string;
}

/**
 * Builds a <style>+<script> block that turns a compiled preview page into a click-to-edit
 * surface:
 *  - text/textarea fields become contentEditable in place, with a small floating Bold/Italic/
 *    Link toolbar that appears on text selection (uses document.execCommand — deprecated but
 *    still universally supported, and the pragmatic choice for a scoped inline-formatting need).
 *  - image fields open a file picker and hand the chosen File to the parent window.
 *  - background fields (a CSS photo set via an inline style declaration, not an <img>) open the
 *    same picker but write the chosen path into that declaration's url(...) instead of src.
 *  - color fields pop a native color input.
 *  - link fields (an <a> whose href is the editable value) pop a native prompt() for the URL —
 *    deliberately NOT contentEditable, since editing the visible link text must never overwrite
 *    its destination (see server/src/lib/compileSite.ts, which treats a "link" field's value as
 *    the href). An admin who wants a link's visible TEXT to be editable instead should tag that
 *    anchor with data-lks-type="text" when authoring the site.
 * All changes are reported to the parent window via postMessage so the same autosave pipeline
 * used by the form-based editor can persist them — this script never talks to the API directly.
 */
export function buildEditorInjection(fields: InjectableField[], websiteId: string): string {
  // Guard against a field label containing "</script>" breaking out of the injected script tag.
  const safeFieldsJson = JSON.stringify(fields).replace(/<\/script/gi, "<\\/script");
  const safeWebsiteId = JSON.stringify(websiteId);

  return `
<style id="lks-editor-style">
  @keyframes lks-fade-up { from { opacity: 0; transform: translate(-50%, -100%) translateY(4px); } to { opacity: 1; transform: translate(-50%, -100%) translateY(0); } }
  @keyframes lks-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lks-panel-in { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  [data-lks-editable] { cursor: pointer; transition: outline-color 120ms ease, background-color 120ms ease; }
  [data-lks-editable]:hover { outline: 2px dashed #8B5CF6; outline-offset: 3px; border-radius: 2px; }
  [data-lks-editable].lks-editing { outline: 2px solid #8B5CF6 !important; outline-offset: 3px; background: rgba(139,92,246,0.07); border-radius: 2px; cursor: text; }

  #lks-editor-badge {
    position: absolute; z-index: 2147483646; pointer-events: none; opacity: 0; visibility: hidden;
    background: #18181b; color: #fff; font: 600 11px/1.4 -apple-system, Inter, Arial, sans-serif;
    padding: 3px 8px; border-radius: 6px; white-space: nowrap;
    transform: translate(-50%, -100%) translateY(-6px); left: 0; top: 0;
    box-shadow: 0 4px 14px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.06) inset;
    transition: opacity 140ms ease, visibility 140ms;
  }
  #lks-editor-badge::after {
    content: ""; position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%);
    border: 4px solid transparent; border-top-color: #18181b;
  }
  #lks-editor-badge.lks-visible { opacity: 1; visibility: visible; }

  #lks-editor-toolbar {
    position: absolute; z-index: 2147483647; display: flex; gap: 2px; opacity: 0; visibility: hidden;
    background: #18181b; border-radius: 10px; padding: 5px; left: 0; top: 0;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset;
    transform: translate(-50%, -100%) translateY(-10px);
    transition: opacity 140ms ease, visibility 140ms, transform 140ms cubic-bezier(0.16,1,0.3,1);
  }
  #lks-editor-toolbar.lks-visible { opacity: 1; visibility: visible; transform: translate(-50%, -100%) translateY(-14px); }
  #lks-editor-toolbar::after {
    content: ""; position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%);
    border: 5px solid transparent; border-top-color: #18181b;
  }
  #lks-editor-toolbar button {
    all: unset; display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 7px; color: #d4d4d8; cursor: pointer;
    font: 600 13px/1 -apple-system, Inter, Arial, sans-serif; transition: background-color 100ms ease, color 100ms ease;
  }
  #lks-editor-toolbar button:hover { background: rgba(255,255,255,0.14); color: #fff; }
  #lks-editor-toolbar button[data-active="true"] { background: #8B5CF6; color: #fff; }

  #lks-media-overlay {
    position: fixed; inset: 0; z-index: 2147483647; display: flex; opacity: 0; visibility: hidden;
    align-items: center; justify-content: center; background: rgba(15,15,17,0.55); backdrop-filter: blur(3px);
    font-family: -apple-system, Inter, Arial, sans-serif;
    transition: opacity 180ms ease, visibility 180ms;
  }
  #lks-media-overlay.lks-visible { opacity: 1; visibility: visible; }
  #lks-media-panel {
    background: #fff; border-radius: 16px; padding: 18px; width: min(440px, 90vw);
    max-height: 80vh; display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 24px 70px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.04);
    opacity: 0; transform: scale(0.96) translateY(6px);
    transition: opacity 180ms cubic-bezier(0.16,1,0.3,1), transform 180ms cubic-bezier(0.16,1,0.3,1);
  }
  #lks-media-overlay.lks-visible #lks-media-panel { opacity: 1; transform: scale(1) translateY(0); }
  #lks-media-panel h3 { margin: 0; font-size: 15px; font-weight: 700; color: #18181b; letter-spacing: -0.01em; }
  #lks-media-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; overflow-y: auto; max-height: 320px; padding: 2px; }
  #lks-media-grid button {
    all: unset; aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: pointer;
    border: 2px solid transparent; background: #f4f4f5; transition: border-color 120ms ease, transform 120ms ease;
  }
  #lks-media-grid button:hover { border-color: #8B5CF6; transform: scale(1.03); }
  #lks-media-grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
  #lks-media-empty { font-size: 12px; color: #71717a; padding: 16px 0; text-align: center; }
  #lks-media-actions { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #f0f0f0; padding-top: 14px; }
  #lks-media-actions button {
    all: unset; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background-color 120ms ease, transform 100ms ease;
  }
  #lks-media-actions button:active { transform: scale(0.97); }
  #lks-media-actions button[data-action="cancel"] { color: #52525b; }
  #lks-media-actions button[data-action="cancel"]:hover { background: #f4f4f5; }
  #lks-media-actions button[data-action="upload"] { background: #8B5CF6; color: #fff; }
  #lks-media-actions button[data-action="upload"]:hover { background: #7C3AED; }
</style>
<script id="lks-editor-script">
(function () {
  var FIELDS = ${safeFieldsJson};
  var WEBSITE_ID = ${safeWebsiteId};
  var fieldByKey = {};
  FIELDS.forEach(function (f) { fieldByKey[f.fieldKey] = f; });

  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}

  var badge = document.createElement('div');
  badge.id = 'lks-editor-badge';

  var toolbar = document.createElement('div');
  toolbar.id = 'lks-editor-toolbar';
  toolbar.innerHTML =
    '<button type="button" data-cmd="bold"><b>B</b></button>' +
    '<button type="button" data-cmd="italic"><i>I</i></button>' +
    '<button type="button" data-cmd="underline"><u>U</u></button>' +
    '<button type="button" data-cmd="link">&#128279;</button>';

  var mediaOverlay = document.createElement('div');
  mediaOverlay.id = 'lks-media-overlay';
  mediaOverlay.innerHTML =
    '<div id="lks-media-panel">' +
      '<h3>Choose an image</h3>' +
      '<div id="lks-media-grid"></div>' +
      '<div id="lks-media-empty" style="display:none">No images uploaded yet.</div>' +
      '<div id="lks-media-actions">' +
        '<button type="button" data-action="cancel">Cancel</button>' +
        '<button type="button" data-action="upload">Upload new&hellip;</button>' +
      '</div>' +
    '</div>';

  function mount() {
    if (!document.body) return;
    if (!badge.parentNode) document.body.appendChild(badge);
    if (!toolbar.parentNode) document.body.appendChild(toolbar);
    if (!mediaOverlay.parentNode) document.body.appendChild(mediaOverlay);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  function post(msg) {
    window.parent.postMessage(Object.assign({ source: 'lks-visual-editor' }, msg), window.location.origin);
  }

  function showBadge(el, label) {
    var rect = el.getBoundingClientRect();
    badge.textContent = label;
    badge.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    badge.style.top = (rect.top + window.scrollY) + 'px';
    badge.classList.add('lks-visible');
  }
  function hideBadge() { badge.classList.remove('lks-visible'); }

  document.addEventListener('mouseover', function (e) {
    if (activeEl) return;
    var el = e.target.closest('[data-lks-editable]');
    if (!el) return;
    var field = fieldByKey[el.getAttribute('data-lks-editable')];
    if (!field) return;
    showBadge(el, field.label);
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('[data-lks-editable]')) hideBadge();
  });

  var activeEl = null;
  var activeField = null;

  function hideToolbar() { toolbar.classList.remove('lks-visible'); }

  function updateToolbarState() {
    ['bold', 'italic', 'underline'].forEach(function (cmd) {
      var btn = toolbar.querySelector('[data-cmd="' + cmd + '"]');
      var active = false;
      try { active = document.queryCommandState(cmd); } catch (e) {}
      btn.setAttribute('data-active', active ? 'true' : 'false');
    });
  }

  function maybeShowToolbarForSelection() {
    if (!activeEl) return hideToolbar();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hideToolbar();
    var range = sel.getRangeAt(0);
    if (!activeEl.contains(range.commonAncestorContainer)) return hideToolbar();
    var rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return hideToolbar();
    toolbar.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    toolbar.style.top = (rect.top + window.scrollY) + 'px';
    toolbar.classList.add('lks-visible');
    updateToolbarState();
  }

  function reportValue() {
    if (!activeEl) return;
    post({ type: 'input', fieldKey: activeField.fieldKey, value: activeEl.innerHTML });
  }

  toolbar.addEventListener('mousedown', function (e) {
    // Prevent the contentEditable field from losing focus/selection before the command runs.
    e.preventDefault();
  });
  toolbar.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-cmd]');
    if (!btn || !activeEl) return;
    var cmd = btn.getAttribute('data-cmd');
    if (cmd === 'link') {
      var url = window.prompt('Link URL (https://, mailto:, tel:, etc.)', 'https://');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    reportValue();
    updateToolbarState();
  });

  function stopEditing() {
    if (activeEl) {
      activeEl.contentEditable = 'false';
      activeEl.classList.remove('lks-editing');
      hideToolbar();
      post({ type: 'deselect', fieldKey: activeField.fieldKey });
    }
    activeEl = null;
    activeField = null;
  }

  function toCamel(prop) {
    return prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function rgbToHex(rgb) {
    var m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return '#8b5cf6';
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      var h = parseInt(n, 10).toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  }

  function editColor(el, field) {
    var prop = el.getAttribute('data-lks-color-prop') || 'color';
    var current = rgbToHex(getComputedStyle(el)[toCamel(prop)] || '#8b5cf6');
    var input = document.createElement('input');
    input.type = 'color';
    input.value = current;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('input', function () {
      el.style[toCamel(prop)] = input.value;
      post({ type: 'input', fieldKey: field.fieldKey, value: input.value });
    });
    input.addEventListener('change', function () {
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    input.click();
  }

  function uploadNewImage(el, field) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) {
        applyImageValue(el, field, URL.createObjectURL(file));
        post({ type: 'image-selected', fieldKey: field.fieldKey, file: file });
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    input.click();
  }

  function closeMediaPicker() {
    mediaOverlay.classList.remove('lks-visible');
  }

  // A "background" field's value never touches src — it's the url(...) inside one declaration
  // of the element's own inline style (e.g. style="--hero-photo:url('images/hero.jpg')"), set on
  // upload by the auto-annotator or by hand via data-lks-bg-prop. An <img> field just sets src.
  function applyImageValue(el, field, value) {
    if (field.fieldType === 'background') {
      var prop = el.getAttribute('data-lks-bg-prop') || 'background-image';
      el.style.setProperty(prop, "url('" + value + "')");
    } else {
      el.setAttribute('src', value);
    }
  }

  // The media library read is a plain same-origin GET using the browser's existing session
  // cookie — safe to call directly from this injected script (unlike writes, which always go
  // back through postMessage so the parent React app owns persistence).
  function editImage(el, field) {
    mediaOverlay.classList.add('lks-visible');
    var grid = document.getElementById('lks-media-grid');
    var empty = document.getElementById('lks-media-empty');
    grid.innerHTML = '<p style="grid-column:1/-1;font-size:12px;color:#a1a1aa;margin:0;">Loading…</p>';
    empty.style.display = 'none';

    fetch('/api/websites/' + WEBSITE_ID + '/assets', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (assets) {
        grid.innerHTML = '';
        if (!assets.length) {
          empty.style.display = 'block';
          return;
        }
        assets.forEach(function (asset) {
          var btn = document.createElement('button');
          btn.type = 'button';
          var img = document.createElement('img');
          img.src = asset.url;
          img.loading = 'lazy';
          btn.appendChild(img);
          btn.addEventListener('click', function () {
            applyImageValue(el, field, asset.path);
            post({ type: 'input', fieldKey: field.fieldKey, value: asset.path });
            closeMediaPicker();
          });
          grid.appendChild(btn);
        });
      })
      .catch(function () {
        grid.innerHTML = '';
        empty.textContent = 'Could not load your media library.';
        empty.style.display = 'block';
      });

    var uploadBtn = document.querySelector('#lks-media-actions [data-action="upload"]');
    var cancelBtn = document.querySelector('#lks-media-actions [data-action="cancel"]');
    uploadBtn.onclick = function () {
      closeMediaPicker();
      uploadNewImage(el, field);
    };
    cancelBtn.onclick = closeMediaPicker;
    mediaOverlay.onclick = function (e) {
      if (e.target === mediaOverlay) closeMediaPicker();
    };
  }

  function editLink(el, field) {
    var current = el.getAttribute('href') || '';
    var next = window.prompt('Link destination (URL, mailto:, tel:, etc.)', current);
    if (next === null) return;
    el.setAttribute('href', next);
    post({ type: 'input', fieldKey: field.fieldKey, value: next });
  }

  document.addEventListener('click', function (e) {
    if (toolbar.contains(e.target)) return;
    if (mediaOverlay.contains(e.target)) return;

    var link = e.target.closest('a');
    if (link) e.preventDefault();

    var el = e.target.closest('[data-lks-editable]');
    if (!el) { stopEditing(); return; }
    var field = fieldByKey[el.getAttribute('data-lks-editable')];
    if (!field) return;

    if (activeEl && activeEl !== el) stopEditing();

    post({ type: 'select', fieldKey: field.fieldKey, fieldType: field.fieldType, label: field.label });
    hideBadge();

    if (field.fieldType === 'image' || field.fieldType === 'background') {
      editImage(el, field);
    } else if (field.fieldType === 'color') {
      editColor(el, field);
    } else if (field.fieldType === 'link') {
      editLink(el, field);
    } else if (field.fieldType === 'text' || field.fieldType === 'textarea') {
      activeEl = el;
      activeField = field;
      el.classList.add('lks-editing');
      el.contentEditable = 'true';
      el.focus();
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!activeEl) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeField.fieldType === 'textarea') {
        document.execCommand('insertHTML', false, '<br>');
        reportValue();
      } else {
        activeEl.blur();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      activeEl.blur();
    }
  });

  document.addEventListener('mouseup', maybeShowToolbarForSelection);
  document.addEventListener('keyup', maybeShowToolbarForSelection);

  var inputTimer = null;
  document.addEventListener('input', function (e) {
    if (!activeEl || e.target !== activeEl) return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(reportValue, 250);
  });

  document.addEventListener('focusout', function (e) {
    if (activeEl && e.target === activeEl) {
      clearTimeout(inputTimer);
      reportValue();
      stopEditing();
    }
  }, true);

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return;
    var msg = e.data;
    if (!msg || msg.source !== 'lks-visual-editor-host' || msg.type !== 'set-value') return;
    var el = document.querySelector('[data-lks-editable="' + msg.fieldKey + '"]');
    if (!el) return;
    var field = fieldByKey[msg.fieldKey];
    if (field && (field.fieldType === 'image' || field.fieldType === 'background')) {
      applyImageValue(el, field, msg.value);
    } else if (field && (field.fieldType === 'text' || field.fieldType === 'textarea')) {
      el.innerHTML = msg.value;
    } else if (field && field.fieldType === 'link') {
      el.setAttribute('href', msg.value);
    } else {
      el.innerText = msg.value;
    }
  });

  post({ type: 'ready' });
})();
</script>
`;
}
