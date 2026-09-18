QUnit.test('MiniAPL names and aliases', assert => {
    for (const [glyph, aliases] of symbols)
        for (const alias of aliases.split(' '))
            assert.ok(matches(alias.replaceAll('-', '')).some(([g]) => g === glyph), alias);
});

QUnit.test('exact names, prefixes and abbreviations', assert => {
    for (const [query, glyph] of [['io', '⍳'], ['RHO', '⍴'], ['lar', '←'], ['grup', '⍋'],
        ['scan', '\\'], ['scanfirst', '⍀'], ['alphaalpha', '⍺⍺']])
        assert.deepEqual(matches(query).map(([g]) => g), [glyph], query);
    assert.deepEqual(matches('sca').map(([g]) => g), ['\\', '⍀'], 'ambiguous prefix');
    assert.deepEqual(matches('notasymbol'), [], 'unknown name');
});

const at = (text, extra = {}) => entry({text, pos: text.length, empty: true, ...extra});

QUnit.test('APL contexts and cursor positions', assert => {
    for (const text of ['%%apl\n`io', '%%apl\r\n`io', '%apl `io', 'answer = %apl `io',
        'π = %apl `io', "%%apl\n'a''b' `io", '%%apl\n⍝ comment\n`io', 'x = "hello"\n%apl `io'])
        assert.ok(at(text), text);
    assert.deepEqual(at('%%apl\n2`io'), {start: 7, query: 'io', found: [['⍳', 'iota']]});
    assert.deepEqual(at('%%apl\n`io suffix', {pos: 9}).found, [['⍳', 'iota']], 'text after cursor');
    assert.deepEqual(at('`rho', {apl: true}).found, [['⍴', 'rho']], 'native APL editor');
    assert.notOk(at('%%apl\n`io', {empty: false}), 'selection');
    assert.notOk(at('%%apl\n`io', {pos: 4}), 'cursor in magic header');
});

QUnit.test('Python, strings, comments and invalid names are unchanged', assert => {
    for (const text of ['`io', "text = '`io", '# %apl `io', "%%apl\n'`io", '%%apl\n⍝ `io',
        'text = """\n%apl `io', '%%aplish\n`io', '%apl `io3', '%%apl\n`io-ta'])
        assert.notOk(at(text), text);
});
