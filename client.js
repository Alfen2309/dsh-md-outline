/**
 * Markdown Outline — Client half.
 *
 * Registers one renderer-specific control into the document preview toolbar
 * (`sidebar.right.tab.document.action`) under the shipped Markdown renderer's
 * implementation id, so the controls appear exactly when a Markdown document
 * is the active preview.
 *
 * Two affordances:
 *  - A dropdown outline from the toolbar button (click a heading to jump).
 *  - A persistent outline panel pinned to the left of the preview body,
 *    toggled from the toolbar, width-adjustable by drag, with the current
 *    section highlighted as the document scrolls.
 */
window.__ModuleLoader__.load({
  id: 'dsh-md-outline',
  factory (require) {
    const React = require('react');
    const h = React.createElement;

    /** The shipped Markdown implementation identity within the document slot. */
    const MARKDOWN_RENDERER_ID = '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown';

    /** Preference storage: panel visibility and width survive reloads. */
    const PREFS_KEY = 'md-outline:prefs';
    const MIN_PANEL_WIDTH = 160;
    const MAX_PANEL_WIDTH = 480;
    const DEFAULT_PANEL_WIDTH = 220;

    /** Locale namespace for the outline UI. */
    const ZH = {
      'button.aria': '目录',
      'button.title': '打开目录',
      'panel.aria': '目录面板',
      'panel.off.title': '在左侧常驻显示目录',
      'panel.on.title': '收起左侧目录',
      'title': '目录',
      'count': '{count} 个标题',
      'empty': '未找到标题',
      'loadingHint': '文档仍在加载，目录会随之更新',
      'resize.aria': '拖拽调整目录宽度',
    };
    const EN = {
      'button.aria': 'Outline',
      'button.title': 'Open outline',
      'panel.aria': 'Outline panel',
      'panel.off.title': 'Pin the outline to the left',
      'panel.on.title': 'Collapse the side outline',
      'title': 'Outline',
      'count': '{count} headings',
      'empty': 'No headings found',
      'loadingHint': 'Still loading; the outline updates as content arrives.',
      'resize.aria': 'Drag to resize the outline',
    };

    const clampWidth = (value) =>
      Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(value)));

    /** Read remembered preferences; corrupt storage falls back to defaults. */
    function loadPrefs () {
      let open = false;
      let width = DEFAULT_PANEL_WIDTH;
      try {
        if (typeof localStorage === 'undefined') return { open, width };
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw === null) return { open, width };
        const saved = JSON.parse(raw);
        if (saved !== null && typeof saved === 'object') {
          if (typeof saved.open === 'boolean') open = saved.open;
          if (typeof saved.width === 'number' && Number.isFinite(saved.width)) width = clampWidth(saved.width);
        }
      } catch (_error) { /* keep defaults */ }
      return { open, width };
    }

    function savePrefs (prefs) {
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch (_error) { /* persistence is best-effort */ }
    }

    /**
     * Stylesheet for both affordances. The dynamic part is the left padding
     * that shifts the preview body's content while the persistent panel is
     * mounted; it keys off the panel element through `:has()`, which the
     * shipped preview CSS already relies on, so no DOM outside this plugin
     * is ever written.
     */
    function styleText (panelWidth) {
      return [
        '.mdo-root{position:relative;display:inline-flex;flex:none;gap:4px}',
        '.mdo-button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:26px;height:26px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
        '.mdo-button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
        '.mdo-button:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
        '.mdo-button[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}',
        '.mdo-popover{position:absolute;top:calc(100% + 6px);right:0;z-index:50;box-sizing:border-box;width:300px;max-height:min(420px,60vh);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:6px 0 0;font-family:var(--dsw-font,sans-serif)}',
        '.mdo-panel{position:absolute;z-index:45;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-layer-1);border-right:0.5px solid var(--dsw-alias-border-l2);box-shadow:2px 0 12px rgba(0,0,0,0.08);font-family:var(--dsw-font,sans-serif)}',
        '.mdo-header,.mdo-panel-head{flex:none;display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:4px 12px 6px;color:var(--dsw-alias-label-secondary);font-size:12px}',
        '.mdo-panel-head{padding:10px 12px 6px;border-bottom:0.5px solid var(--dsw-alias-border-l1)}',
        '.mdo-title{font-weight:600}',
        '.mdo-count{flex:none}',
        '.mdo-list,.mdo-panel-list{min-height:0;overflow:auto;padding:0 4px 6px}',
        '.mdo-panel-list{flex:auto;padding:6px 6px 8px}',
        '.mdo-item{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;background:transparent;text-align:left;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font,sans-serif);font-size:13px;line-height:1.45;padding-top:5px;padding-bottom:5px;padding-right:10px;border-radius:6px;cursor:pointer;min-width:0;position:relative}',
        '.mdo-item:hover{background:var(--dsw-alias-bg-layer-2)}',
        '.mdo-item:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:-1px}',
        '.mdo-item[data-md-outline-active="true"]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}',
        '.mdo-bullet{flex:none;width:6px;height:6px;border-radius:2px;background:var(--dsw-alias-label-secondary);opacity:0.55}',
        '.mdo-item[data-md-outline-level="1"] .mdo-bullet{background:var(--dsw-alias-brand-primary);opacity:0.9}',
        '.mdo-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
        '.mdo-empty{margin:0;padding:8px 12px 12px;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:normal}',
        '.mdo-hint{flex:none;margin:0;padding:6px 12px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;border-top:0.5px solid var(--dsw-alias-border-l1)}',
        '.mdo-resize{position:absolute;top:0;right:-4px;width:9px;height:100%;cursor:col-resize}',
        '.mdo-resize::after{content:"";position:absolute;top:0;bottom:0;left:4px;width:1px;background:transparent}',
        '.mdo-resize:hover::after,.mdo-resize[data-md-outline-resizing="true"]::after{background:var(--dsw-alias-brand-primary)}',
        /* While the persistent panel is mounted, reserve its strip in the
         * preview body so the document shifts right instead of hiding. */
        `[data-document-preview]:has([data-md-outline-panel]) [data-textpreview-body]{padding-left:${panelWidth + 12}px}`,
      ].join('\n');
    }

    const OUTLINE_ICON = h('svg', {
      viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', fill: 'currentColor',
    },
      h('rect', { x: 1.5, y: 2.6, width: 13, height: 1.8, rx: 0.9 }),
      h('rect', { x: 4.2, y: 7.1, width: 10.3, height: 1.8, rx: 0.9 }),
      h('rect', { x: 6.9, y: 11.6, width: 7.6, height: 1.8, rx: 0.9 }));

    const PANEL_ICON = h('svg', {
      viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true',
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
    },
      h('rect', { x: 1.8, y: 2.5, width: 12.4, height: 11, rx: 1.5 }),
      h('line', { x1: 5.8, y1: 2.5, x2: 5.8, y2: 13.5 }),
      h('line', { x1: 7.8, y1: 5.4, x2: 11.8, y2: 5.4 }),
      h('line', { x1: 7.8, y1: 8.0, x2: 10.6, y2: 8.0 }),
      h('line', { x1: 7.8, y1: 10.6, x2: 11.2, y2: 10.6 }));

    /**
     * Collect the currently rendered Markdown headings, in document order.
     * @param {Element} root - the enclosing preview root (`[data-document-preview]`).
     * @returns {Array<{id:string,level:number,text:string,el:HTMLElement}>} outline entries.
     */
    function collectHeadings (root) {
      const documentEl = root.querySelector('[data-document-markdown]');
      if (documentEl === null) return [];
      const nodes = documentEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
      const found = [];
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        const text = (node.textContent || '').replace(/\s+/gu, ' ').trim();
        if (text === '') continue;
        found.push({
          id: `${index}:${text.slice(0, 48)}`,
          level: Number(node.tagName.slice(1)),
          text,
          el: node,
        });
      }
      return found;
    }

    /** The preview root and scrollport for this toolbar entry's own preview. */
    function previewParts (span) {
      const root = span instanceof Element ? span.closest('[data-document-preview]') : null;
      const body = root !== null ? root.querySelector('[data-textpreview-body]') : null;
      return { root, body };
    }

    /**
     * One renderer-specific toolbar control: outline dropdown plus the
     * persistent left outline panel with its toggle.
     *
     * @param {object} props - slot props; `content` carries the preview's
     * accumulated text, and `t` is the bound locale translate.
     */
    function OutlineTool (props) {
      const content = props.content;
      const t = props.t;
      const rootRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const listRef = React.useRef(null);
      const entriesRef = React.useRef([]);
      const [dropdownOpen, setDropdownOpen] = React.useState(false);
      const [entries, setEntries] = React.useState([]);
      const [activeId, setActiveId] = React.useState(null);
      const initialPrefs = React.useMemo(loadPrefs, []);
      const [panelOpen, setPanelOpen] = React.useState(initialPrefs.open);
      const [width, setWidth] = React.useState(initialPrefs.width);

      entriesRef.current = entries;

      const isText = content !== undefined && content !== null && content.kind === 'text';
      const eof = isText ? content.eof !== false : true;
      const textLength = isText && typeof content.text === 'string' ? content.text.length : 0;
      const wantEntries = dropdownOpen || panelOpen;

      /* Keep the outline current while either affordance is visible: the
       * preview loads pages incrementally and re-parses as text accumulates. */
      React.useEffect(() => {
        if (!wantEntries) return undefined;
        const root = rootRef.current !== null ? rootRef.current.closest('[data-document-preview]') : null;
        if (root === null) {
          setEntries([]);
          return undefined;
        }
        let frame = 0;
        const rescan = () => {
          if (frame !== 0) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            setEntries(collectHeadings(root));
          });
        };
        rescan();
        const observer = new MutationObserver(rescan);
        observer.observe(root, { childList: true, subtree: true });
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          observer.disconnect();
        };
      }, [wantEntries, textLength]);

      /* Remember panel visibility and width across sessions. */
      React.useEffect(() => {
        savePrefs({ open: panelOpen, width });
      }, [panelOpen, width]);

      /* Close the dropdown on outside pointer press and Escape. */
      React.useEffect(() => {
        if (!dropdownOpen) return undefined;
        const onPointerDown = (event) => {
          const root = rootRef.current;
          if (root !== null && !root.contains(event.target)) setDropdownOpen(false);
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setDropdownOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [dropdownOpen]);

      /* Pin the persistent panel over the preview body's left strip: the
       * panel is absolutely positioned within this entry's own span. A
       * per-frame watcher compares the body's live rect with the applied
       * offsets instead of relying on ResizeObserver, because layout often
       * settles by MOVING the body without resizing it (sidebar open
       * animation, main panel resize, changed-file bar): size observers never
       * see that and the panel would stay at a stale first-measurement spot.
       * Reads are cheap and style writes happen only when a value changes. */
      React.useEffect(() => {
        if (!panelOpen) return undefined;
        const span = rootRef.current;
        const { body } = previewParts(span);
        const panel = panelRef.current;
        if (span === null || body === null || panel === null) return undefined;
        let frame = 0;
        let lastLeft = null;
        let lastTop = null;
        let lastHeight = null;
        const tick = () => {
          frame = requestAnimationFrame(tick);
          const spanRect = span.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();
          const left = Math.round(bodyRect.left - spanRect.left);
          const top = Math.round(bodyRect.top - spanRect.top);
          const height = Math.round(bodyRect.height);
          if (left === lastLeft && top === lastTop && height === lastHeight) return;
          lastLeft = left;
          lastTop = top;
          lastHeight = height;
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
          panel.style.height = `${height}px`;
        };
        frame = requestAnimationFrame(tick);
        return () => {
          cancelAnimationFrame(frame);
        };
      }, [panelOpen]);

      /* Highlight the section the reader is in while the panel is visible. */
      React.useEffect(() => {
        if (!panelOpen) {
          setActiveId(null);
          return undefined;
        }
        const body = previewParts(rootRef.current).body;
        if (body === null) return undefined;
        let frame = 0;
        const compute = () => {
          if (frame !== 0) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const viewportTop = body.getBoundingClientRect().top;
            let active = null;
            for (const entry of entriesRef.current) {
              const el = entry.el;
              if (!(el instanceof HTMLElement)) continue;
              if (el.getBoundingClientRect().top - viewportTop <= 24) active = entry;
              else break;
            }
            setActiveId(active === null ? null : active.id);
          });
        };
        compute();
        body.addEventListener('scroll', compute, { passive: true });
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          body.removeEventListener('scroll', compute);
        };
      }, [panelOpen, entries]);

      /* Keep the highlighted entry visible inside the panel list. */
      React.useEffect(() => {
        if (!panelOpen || activeId === null || listRef.current === null) return;
        const item = listRef.current.querySelector('[data-md-outline-active="true"]');
        if (item !== null) item.scrollIntoView({ block: 'nearest' });
      }, [activeId, panelOpen]);

      /** Scroll the preview scrollport so the heading sits near its top. */
      const reveal = (element) => {
        const body = previewParts(rootRef.current).body;
        if (body === null || !(element instanceof HTMLElement)) return;
        const delta = element.getBoundingClientRect().top - body.getBoundingClientRect().top;
        body.scrollTop = Math.max(0, Math.round(body.scrollTop + delta - 8));
      };

      /** Drag the panel's right edge to resize; width persists on release. */
      const startResize = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        const startX = event.clientX;
        const startWidth = width;
        const onMove = (moveEvent) => {
          setWidth(clampWidth(startWidth + (moveEvent.clientX - startX)));
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        event.preventDefault();
      };

      if (!isText) return null;

      let minLevel = 6;
      for (const entry of entries) minLevel = Math.min(minLevel, entry.level);

      const renderItem = (entry, options) => h('button', {
        key: entry.id,
        type: 'button',
        className: 'mdo-item',
        role: options.menu ? 'menuitem' : undefined,
        style: { paddingLeft: `${10 + (entry.level - minLevel) * 14}px` },
        'data-md-outline-level': String(entry.level),
        'data-md-outline-active': options.trackActive && entry.id === activeId ? 'true' : undefined,
        title: entry.text,
        onClick: () => {
          reveal(entry.el);
          if (options.close) setDropdownOpen(false);
        },
      },
      h('span', { className: 'mdo-bullet', 'data-md-outline-level': String(entry.level) }),
      h('span', { className: 'mdo-text' }, entry.text));

      const listBody = entries.length === 0
        ? h('p', { className: 'mdo-empty' }, t('empty'))
        : entries.map((entry) => renderItem(entry, { menu: false, trackActive: true, close: false }));

      return h('span', { ref: rootRef, className: 'mdo-root', 'data-md-outline': 'true' },
        h('style', null, styleText(width)),
        h('button', {
          type: 'button',
          className: 'mdo-button',
          'aria-pressed': panelOpen,
          'aria-label': t('panel.aria'),
          title: panelOpen ? t('panel.on.title') : t('panel.off.title'),
          'data-md-outline-panel-toggle': 'true',
          onClick: () => { setPanelOpen((value) => !value); },
        }, PANEL_ICON),
        h('button', {
          type: 'button',
          className: 'mdo-button',
          'aria-haspopup': 'menu',
          'aria-expanded': dropdownOpen,
          'aria-label': t('button.aria'),
          title: t('button.title'),
          'data-md-outline-toggle': 'true',
          onClick: () => { setDropdownOpen((value) => !value); },
        }, OUTLINE_ICON),
        dropdownOpen && h('div', {
          className: 'mdo-popover',
          role: 'menu',
          'aria-label': t('title'),
          'data-md-outline-popover': 'true',
        },
          h('div', { className: 'mdo-header' },
            h('span', { className: 'mdo-title' }, t('title')),
            entries.length > 0 && h('span', { className: 'mdo-count' }, t('count', { count: String(entries.length) }))),
          entries.length === 0
            ? h('p', { className: 'mdo-empty' }, t('empty'))
            : h('div', { className: 'mdo-list' }, entries.map((entry) => renderItem(entry, { menu: true, trackActive: false, close: true }))),
          !eof && h('p', { className: 'mdo-hint' }, t('loadingHint'))),
        panelOpen && h('div', {
          ref: panelRef,
          className: 'mdo-panel',
          style: { width: `${width}px` },
          role: 'navigation',
          'aria-label': t('panel.aria'),
          'data-md-outline-panel': 'true',
        },
          h('div', { className: 'mdo-panel-head' },
            h('span', { className: 'mdo-title' }, t('title')),
            entries.length > 0 && h('span', { className: 'mdo-count' }, t('count', { count: String(entries.length) }))),
          h('div', { ref: listRef, className: 'mdo-panel-list' }, listBody),
          !eof && h('p', { className: 'mdo-hint' }, t('loadingHint')),
          h('div', {
            className: 'mdo-resize',
            role: 'separator',
            'aria-orientation': 'vertical',
            'aria-label': t('resize.aria'),
            'data-md-outline-resize': 'true',
            onPointerDown: startResize,
          })));
    }

    return {
      inject: ['slots', 'locale'],
      apply (ctx) {
        const disposeLocale = ctx.locale.register('mdOutline', { zh: ZH, en: EN });
        const t = ctx.locale.bind('mdOutline');
        const disposeSlot = ctx.slots.inject('sidebar.right.tab.document.action', () =>
          ctx.slots.register({
            name: 'sidebar.right.tab.document.action',
            key: MARKDOWN_RENDERER_ID,
          }, (props) => h(OutlineTool, Object.assign({}, props, { t }))));
        return () => {
          disposeSlot();
          disposeLocale();
        };
      },
    };
  },
});
