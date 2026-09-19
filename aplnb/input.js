((symbols, keyboard) => {
    // US physical keys, before macOS Option or another layout transforms event.key.
    const punctuation = {Backquote: '`~', Minus: '-_', Equal: '=+', BracketLeft: '[{', BracketRight: ']}',
        Backslash: '\\|', Semicolon: ';:', Quote: "'\"", Comma: ',<', Period: '.>', Slash: '/?'};
    function chord(ev) {
        const {code, shiftKey} = ev;
        let key;
        if (/^Key[A-Z]$/.test(code)) key = shiftKey ? code.slice(3) : code.slice(3).toLowerCase();
        else if (/^Digit[0-9]$/.test(code)) key = shiftKey ? ')!@#$%^&*('[Number(code[5])] : code[5];
        else key = punctuation[code]?.[Number(shiftKey)];
        return keyboard[key];
    }

    function matches(query) {
        query = query.toLowerCase();
        let best = 3, found = [];
        for (const [glyph, aliases] of symbols) {
            let rank = 3, name;
            for (const alias of aliases.split(' ')) {
                const letters = alias.replaceAll('-', '');
                let i = 1;
                for (const c of letters.slice(1)) if (c === query[i]) i++;
                const r = letters === query ? 0 : letters.startsWith(query) ? 1 :
                    letters[0] === query[0] && i === query.length ? 2 : 3;
                if (r < rank) { rank = r; name = alias; }
            }
            if (rank < best) { best = rank; found = []; }
            if (rank < 3 && rank === best) found.push([glyph, name]);
        }
        return found;
    }

    function inCode(text, python = false) {
        let quote = '', comment = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (comment) { if (c === '\n') comment = false; }
            else if (quote) {
                if (python && c === '\\') i++;
                else if (text.startsWith(quote, i)) { i += quote.length - 1; quote = ''; }
            } else if (c === "'" || c === '"') {
                quote = python && text.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
                i += quote.length - 1;
            } else if (c === (python ? '#' : '⍝')) comment = true;
        }
        return !quote && !comment;
    }

    function aplStart(e) {
        if (e.apl) return 0;
        const header = /^%%apl[^\S\n]*(?:\r?\n|$)/.exec(e.text);
        if (header) return e.pos >= header[0].length ? header[0].length : -1;
        const start = e.text.lastIndexOf('\n', e.pos - 1) + 1;
        const line = /^[ \t]*(?:[\p{ID_Start}_][\p{ID_Continue}]*[ \t]*=[ \t]*)?%apl[ \t]+/u.exec(e.text.slice(start, e.pos));
        return line && inCode(e.text.slice(0, start), true) ? start + line[0].length : -1;
    }

    function entry(e) {
        const body = aplStart(e), start = e.text.lastIndexOf('`', e.pos - 1);
        if (body < 0 || start < body || !e.empty || !inCode(e.text.slice(body, start))) return;
        const query = e.text.slice(start + 1, e.pos);
        if (/^[a-z]*$/i.test(query)) return {start, query, found: matches(query)};
    }

    return {matches, inCode, aplStart, entry, chord};
})
