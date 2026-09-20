import json
from importlib.resources import files
from pathlib import Path

import pytest, pytest_asyncio
from IPython.core.interactiveshell import InteractiveShell
from IPython.utils.capture import capture_output
from fastcdp import CDP
from basedpl import Session, symbols
from aplnb.core import APLMagic

pytestmark = pytest.mark.asyncio
keyboard = (files('basedpl')/'keyboard.json').read_text()


@pytest_asyncio.fixture
async def page():
    async with CDP.testing(headless=True) as cdp:
        async with await cdp.new_page(background=True) as page: yield page


async def test_input(page):
    source = (files('aplnb')/'input.js').read_text()
    tests = Path(__file__).with_name('input.js').read_text()
    result = await page.run_qunit(f'const symbols = {json.dumps(symbols)}, keyboard = {keyboard}; '
        f'const {{matches, entry, chord}} = {source}(symbols, keyboard);\n{tests}')
    assert result['status'] == 'passed', result


editors = dict(textarea=r"""
    const view = mount.appendChild(document.createElement('textarea'));
    window.setEditor = text => { view.value = text; view.selectionStart = view.selectionEnd = text.length; view.focus(); };
    window.readEditor = () => view.value;
""", codemirror=r"""
    const {EditorView, basicSetup} = await import('https://esm.sh/codemirror@6.0.2');
    const view = new EditorView({extensions: basicSetup, parent: mount});
    window.setEditor = text => {
        view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: text}, selection: {anchor: text.length}});
        view.focus();
    };
    window.readEditor = () => view.state.doc.toString();
""", monaco=r"""
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
        script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    require.config({paths: {vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'}});
    await new Promise((resolve, reject) => require(['vs/editor/editor.main'], resolve, reject));
    const view = monaco.editor.create(mount, {language: 'python', minimap: {enabled: false}, experimentalEditContextEnabled: true});
    window.setEditor = text => { view.setValue(text); view.setPosition(view.getModel().getPositionAt(text.length)); view.focus(); };
    window.readEditor = () => view.getValue();
""")


@pytest.mark.parametrize('editor', editors)
async def test_editor(page, editor):
    InteractiveShell.instance()
    with Session() as apl, capture_output() as captured: APLMagic(session=apl).apl('')
    await page.set_content('<div id="mount" style="width:600px;height:200px"></div>')
    await page.eval(f'(async () => {{{editors[editor]}}})()')
    await page.eval(captured.outputs[0].data['application/javascript'])
    await page.eval(r"setEditor('%%apl\n')")
    await page.type('2`times3 ')
    assert await page.eval('readEditor()') == '%%apl\n2×3 '
    await page.type('`sca')
    await page.press('Tab')
    assert await page.eval('readEditor()') == '%%apl\n2×3 `sca'
    await page.eval(r"""window.choiceButton = document.querySelector('.aplnb_choices button[title="scan-first"]')""")
    await page.press('Tab')
    assert await page.eval('choiceButton.isConnected')
    await page.click('.aplnb_choices button[title="scan-first"]')
    assert await page.eval('readEditor()') == '%%apl\n2×3 ⍀'
    await page.press('z', mod=True)
    assert await page.eval('readEditor()') == '%%apl\n2×3 `sca'
    await page.eval(r"setEditor('%%apl\n')")
    await page.type('`rho')
    await page.eval(r"""document.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && ev.shiftKey) { window.submitted = readEditor(); ev.preventDefault(); }
    }, true);""")
    await page.Input.dispatchKeyEvent(type='rawKeyDown', key='Shift', modifiers=8, windowsVirtualKeyCode=16)
    await page.press('Enter', shift=True)
    await page.Input.dispatchKeyEvent(type='keyUp', key='Shift', windowsVirtualKeyCode=16)
    assert await page.eval('window.submitted') == '%%apl\n⍴'

    async def chord(code, key, shift=False, side='Left'):
        modifiers = 1 | (8 if shift else 0)
        await page.Input.dispatchKeyEvent(type='rawKeyDown', code=f'Alt{side}', key='Alt', modifiers=1, location=1 if side=='Left' else 2)
        await page.Input.dispatchKeyEvent(type='rawKeyDown', code=code, key=key, modifiers=modifiers)
        await page.Input.dispatchKeyEvent(type='keyUp', code=code, key=key, modifiers=modifiers)
        await page.Input.dispatchKeyEvent(type='keyUp', code=f'Alt{side}', key='Alt', location=1 if side=='Left' else 2)

    await page.eval(r"setEditor('%%apl\n')")
    for code, key, shift in [('KeyH', '˙', False), ('Minus', '–', False), ('KeyA', 'Å', True), ('BracketRight', '‘', False)]:
        await chord(code, key, shift)
    assert await page.eval('readEditor()') == '%%apl\n←×⍶⎕'
    await page.press('z', mod=True)
    assert await page.eval('readEditor()') == '%%apl\n←×⍶'
    for text in ["%%apl\n'", '%%apl\n⍝ ', '%apl ', 'v = %apl ']:
        await page.eval(f'setEditor({json.dumps(text)})')
        await chord('Minus', '–')
        assert await page.eval('readEditor()') == text + '×'
    for text, side in [('%%apl\n', 'Right'), ('ordinary_python', 'Left')]:
        await page.eval(f'setEditor({json.dumps(text)})')
        await chord('Minus', '–', side=side)
        assert await page.eval('readEditor()') == text
