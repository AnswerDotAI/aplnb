// Based on Adám Brudzewsky's APL language bar: https://abrudz.github.io/lb
// MIT License, Copyright (c) 2011-2020 Nikolay G. Nikolov and Adam Brudzevski.
// bAsedPL name completion, editor adapters, dark mode and overlay layout by Jeremy Howard.
((symbols, input, keyboard) => {
    const d = document;
    if (d.querySelector('.ngn_lb') || d.querySelector('meta[name=generator][content^=quarto]')) return;

    const {inCode, aplStart, entry, chord} = input(symbols, keyboard);
    const shortcuts = new Map(symbols.map(([glyph, , , , , shortcut]) => [glyph, shortcut]));
    let leftAlt = false, rightAlt = false;

    function textareaRect(t) {
        const mirror = d.createElement('div'), caret = d.createElement('span'), css = getComputedStyle(t), rect = t.getBoundingClientRect();
        for (const p of ['font', 'lineHeight', 'letterSpacing', 'padding', 'border', 'boxSizing', 'width', 'tabSize']) mirror.style[p] = css[p];
        Object.assign(mirror.style, {position: 'fixed', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
            left: `${rect.left - t.scrollLeft}px`, top: `${rect.top - t.scrollTop}px`});
        mirror.textContent = t.value.slice(0, t.selectionStart);
        caret.textContent = '\u200b';
        mirror.append(caret);
        d.body.append(mirror);
        const result = caret.getBoundingClientRect();
        mirror.remove();
        return result;
    }

    function editor(target) {
        if (target.closest?.('.text_cell, .jp-MarkdownCell')) return;
        const m = window.monaco?.editor?.getEditors?.().find(e => e.hasTextFocus());
        if (m) {
            const model = m.getModel(), p = m.getPosition(), selection = m.getSelection();
            if (model.getLanguageId() === 'markdown' || m.getOption(window.monaco.editor.EditorOption.readOnly)) return;
            return {id: m, text: model.getValue(), pos: model.getOffsetAt(p), empty: selection.isEmpty(), apl: model.getLanguageId() === 'apl',
                rect: () => {
                    const r = m.getDomNode().getBoundingClientRect(), c = m.getScrolledVisiblePosition(p);
                    return {left: r.left + c.left, bottom: r.top + c.top + c.height};
                },
                insert: (text, from = model.getOffsetAt(selection.getStartPosition())) => {
                    const a = model.getPositionAt(from), b = selection.getEndPosition();
                    m.pushUndoStop();
                    m.executeEdits('aplnb', [{range: {startLineNumber: a.lineNumber, startColumn: a.column,
                        endLineNumber: b.lineNumber, endColumn: b.column}, text}], () => {
                        const end = model.getPositionAt(from + text.length);
                        return [new window.monaco.Selection(end.lineNumber, end.column, end.lineNumber, end.column)];
                    });
                    m.pushUndoStop();
                    m.focus();
                }};
        }
        const view = target.closest?.('.cm-editor')?.querySelector('.cm-content')?.cmTile?.view;
        if (view) {
            if (view.state.readOnly) return;
            const sel = view.state.selection.main;
            return {id: view, text: view.state.doc.toString(), pos: sel.head, empty: sel.empty,
                rect: () => view.coordsAtPos(sel.head),
                insert: (text, from = sel.from) => {
                    view.dispatch({changes: {from, to: sel.to, insert: text}, selection: {anchor: from + text.length}, userEvent: 'input.complete'});
                    view.focus();
                }};
        }
        if (target.tagName !== 'TEXTAREA' || target.readOnly || target.disabled) return;
        return {id: target, text: target.value, pos: target.selectionStart, empty: target.selectionStart === target.selectionEnd,
            rect: () => textareaRect(target),
            insert: (text, from = target.selectionStart) => {
                target.focus();
                target.selectionStart = from;
                d.execCommand('insertText', false, text);
            }};
    }

    const host = d.createElement('div');
    host.innerHTML = `<div class="ngn_lb" aria-label="APL symbols"><button class="ngn_x" title="Close symbol bar">×</button><button class="ngn_o" title="Toggle overlay/push-down"></button></div>
        <div class="aplnb_choices" role="group" aria-label="APL symbol completions" hidden></div>
        <style>
        .ngn_lb,.aplnb_choices{background:#eee;color:#111;font:15px 'SAX2',monospace;z-index:2147483647}
        .ngn_lb{position:fixed;top:0;left:0;right:0;border-bottom:1px solid #999;padding:2px}
        .ngn_lb button,.aplnb_choices button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:2px 4px}
        .ngn_lb button:hover,.aplnb_choices button:hover{background:#777;color:white}
        .ngn_x,.ngn_o{float:right}
        .aplnb_choices{position:fixed;max-height:240px;max-width:calc(100vw - 16px);overflow:auto;border:1px solid #888;border-radius:4px;box-shadow:0 3px 12px #0003;padding:4px}
        .aplnb_choices button{display:block;width:100%;text-align:left;white-space:nowrap}
        .aplnb_choices small{display:block;padding:4px}
        @media(prefers-color-scheme:dark){.ngn_lb,.aplnb_choices{background:#222;color:#ddd}.ngn_lb button:hover,.aplnb_choices button:hover{background:#bbb;color:#111}}
        </style>`;
    d.body.append(host);
    const bar = host.querySelector('.ngn_lb'), tip = host.querySelector('.aplnb_choices'), toggle = bar.querySelector('.ngn_o');
    let overlay = false, active, lastEditor, choice, keyInput = false;
    const originalPadding = d.body.style.paddingTop;
    try { overlay = localStorage.getItem('ngn_lb_overlay') === '1'; } catch {}
    function layout() {
        toggle.textContent = overlay ? '▼' : '▲';
        d.body.style.paddingTop = overlay || bar.hidden ? originalPadding : `${bar.offsetHeight}px`;
    }
    function button(glyph, name) {
        const b = d.createElement('button');
        b.type = 'button'; b.textContent = glyph; b.title = name + shortcuts.get(glyph); b.dataset.glyph = glyph;
        return b;
    }
    for (const [glyph, name, monad, dyad, aliases] of symbols)
        bar.append(button(glyph, [...new Set([name, monad, dyad, aliases].join(' ').split(' ').filter(Boolean))].join(' ')));
    new ResizeObserver(layout).observe(bar);
    layout();

    function cancel() { active = undefined; choice = undefined; tip.hidden = true; }
    function show(e, item) {
        if (choice?.item.query !== item.query) {
            tip.replaceChildren();
            for (const [glyph, name] of item.found) {
                const b = button(glyph, name);
                b.textContent = `${glyph} ${b.title}`;
                tip.append(b);
            }
            if (!item.found.length) {
                const note = d.createElement('small'); note.textContent = 'Unknown symbol'; tip.append(note);
            }
        }
        choice = {e, item};
        tip.hidden = false;
        const r = e.rect();
        tip.style.left = `${Math.max(4, Math.min(r.left, innerWidth - tip.offsetWidth - 8))}px`;
        tip.style.top = `${Math.max(bar.hidden || overlay ? 4 : bar.offsetHeight, Math.min(r.bottom + 4, innerHeight - tip.offsetHeight - 8))}px`;
    }
    function refresh(target) {
        const e = editor(target), item = e && entry(e);
        if (item && active?.id === e.id && active.start === item.start) show(e, item);
        else cancel();
    }
    bar.addEventListener('mousedown', ev => {
        ev.preventDefault();
        const b = ev.target.closest('button');
        if (b?.classList.contains('ngn_x')) { bar.hidden = true; layout(); }
        else if (b === toggle) {
            overlay = !overlay;
            try { localStorage.setItem('ngn_lb_overlay', overlay ? '1' : '0'); } catch {}
            layout();
        } else if (b?.dataset.glyph && lastEditor) lastEditor.insert(b.dataset.glyph);
        cancel();
    });
    tip.addEventListener('mousedown', ev => {
        ev.preventDefault();
        const b = ev.target.closest('button');
        if (b && choice) choice.e.insert(b.dataset.glyph, choice.item.start);
        cancel();
    });
    d.addEventListener('focusin', ev => { lastEditor = editor(ev.target); cancel(); });
    d.addEventListener('pointerdown', ev => { if (!host.contains(ev.target)) cancel(); }, true);
    d.addEventListener('pointerup', ev => { if (!host.contains(ev.target)) lastEditor = editor(ev.target); });
    for (const event of ['paste', 'cut', 'compositionstart', 'focusout']) d.addEventListener(event, cancel, true);
    d.addEventListener('input', ev => {
        if (!keyInput || ev.inputType !== 'insertText' && ev.inputType !== 'deleteContentBackward') cancel();
        keyInput = false;
        requestAnimationFrame(() => { lastEditor = editor(ev.target); refresh(ev.target); });
    });
    window.addEventListener('blur', () => { leftAlt = rightAlt = false; cancel(); });
    window.addEventListener('keyup', ev => {
        if (ev.code === 'AltLeft') leftAlt = false;
        if (ev.code === 'AltRight') rightAlt = false;
        keyInput = false; lastEditor = editor(ev.target); if (active) refresh(ev.target);
    }, true);
    window.addEventListener('keydown', ev => {
        keyInput = false;
        if (ev.code === 'AltLeft') leftAlt = true;
        if (ev.code === 'AltRight') rightAlt = true;
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
        const e = editor(ev.target);
        if (!e || ev.isComposing || ev.defaultPrevented) { cancel(); return; }
        lastEditor = e;
        if (leftAlt && !rightAlt && ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.getModifierState('AltGraph') && aplStart(e) >= 0) {
            const glyph = chord(ev);
            if (glyph) {
                cancel();
                e.insert(glyph);
                ev.preventDefault(); ev.stopImmediatePropagation(); return;
            }
        }
        const item = entry(e), plain = !ev.ctrlKey && !ev.altKey && !ev.metaKey;
        const tab = ev.key === 'Tab' && plain && !ev.shiftKey, enter = ev.key === 'Enter';
        const typed = active?.id === e.id && active.start === item?.start;
        const delimiter = plain && ev.key.length === 1 && !/[a-z]/i.test(ev.key);
        if (item && (tab || typed && (enter || delimiter))) {
            if (item.found.length === 1) {
                e.insert(item.found[0][0], item.start);
                cancel();
            } else if (tab) {
                active = {id: e.id, start: item.start};
                show(e, item);
            }
            if (tab) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
        }
        if (ev.key === '`' && plain) {
            const updated = editor(ev.target), body = aplStart(updated);
            if (body >= 0 && updated.empty && inCode(updated.text.slice(body, updated.pos))) active = {id: updated.id, start: updated.pos};
            else cancel();
        } else if (!(typed && plain && (/^[a-z]$/i.test(ev.key) || ev.key === 'Backspace'))) cancel();
        keyInput = plain && (ev.key.length === 1 || ev.key === 'Backspace');
    }, true);
})
