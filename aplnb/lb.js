// APL language bar by Adám Brudzewsky: https://abrudz.github.io/lb (source: https://github.com/abrudz/lb)
// MIT License, Copyright (c) 2011-2020 Nikolay G. Nikolov and Adam Brudzevski. This is a modified copy bundled with iversonnb.
// Changes from upstream: double backtick composes ```; insertion via insertText so undo and input events work;
// Monaco editor support (incl. EditContext mode); dark mode; overlay/push-down toggle persisted per site;
// idempotent injection; ResizeObserver-driven layout; @font-face with dead url() removed; skipped on quarto-rendered pages.
; (_ => {
	if (document.querySelector('.ngn_lb')) return
	if (document.querySelector('meta[name=generator][content^=quarto]')) return //no bar on rendered docs pages
	let hc = { '<': '&lt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }, he = x => x.replace(/[<&'"]/g, c => hc[c]) //html chars and escape fn
		, tcs = '<-←xx×/\\×:-÷*O⍟[-⌹-]⌹OO○77⌈FF⌈ll⌊LL⌊T_⌶II⌶|_⊥TT⊤-|⊣|-⊢=/≠L-≠<=≤<_≤>=≥>_≥==≡=_≡7=≢Z-≢vv∨^^∧^~⍲v~⍱^|↑v|↓((⊂cc⊂(_⊆c_⊆))⊃[|⌷|]⌷A|⍋V|⍒ii⍳i_⍸ee∊e_⍷' +
			'uu∪UU∪nn∩/-⌿\\-⍀,-⍪rr⍴pp⍴O|⌽O-⊖O\\⍉::¨""¨~:⍨~"⍨*:⍣*"⍣oo∘o:⍤o"⍤O:⍥O"⍥[\'⍞\']⍞[]⎕[:⍠:]⍠[=⌸=]⌸[<⌺>]⌺o_⍎oT⍕o-⍕<>⋄^v⋄on⍝->→aa⍺ww⍵VV∇v-∇--¯0~⍬' +
			'AA∆^-∆A_⍙^=⍙[?⍰?]⍰:V⍢∇"⍢||∥ox¤)_⊇_)⊇V~⍫\'\'`'
		, lbs = ['←←\nASSIGN', ' ', '++\nconjugate\nplus', '--\nnegate\nminus', '××\ndirection\ntimes', '÷÷\nreciprocal\ndivide', '**\nexponential\npower', '⍟⍟\nnatural logarithm\nlogarithm',
			'⌹⌹\nmatrix inverse\nmatrix divide', '○○\npi times\ncircular', '!!\nfactorial\nbinomial', '??\nroll\ndeal', ' ', '||\nmagnitude\nresidue',
			'⌈⌈\nceiling\nmaximum', '⌊⌊\nfloor\nminimum', '⊥⊥\ndecode', '⊤⊤\nencode', '⊣⊣\nsame\nleft', '⊢⊢\nsame\nright', ' ', '==\nequal', '≠≠\nunique mask\nnot equal',
			'≤≤\nless than or equal to', '<<\nless than', '>>\ngreater than', '≥≥\ngreater than or equal to', '≡≡\ndepth\nmatch', '≢≢\ntally\nnot match', ' ', '∨∨\ngreatest common divisor/or',
			'∧∧\nlowest common multiple/and', '⍲⍲\nnand', '⍱⍱\nnor', ' ', '↑↑\nmix\ntake', '↓↓\nsplit\ndrop', '⊂⊂\nenclose\npartioned enclose', '⊃⊃\nfirst\npick', '⊆⊆\nnest\npartition', '⌷⌷\nmaterialise\nindex', '⍋⍋\ngrade up\ngrades up',
			'⍒⍒\ngrade down\ngrades down', ' ', '⍳⍳\nindices\nindices of', '⍸⍸\nwhere\ninterval index', '∊∊\nenlist\nmember of', '⍷⍷\nfind', '∪∪\nunique\nunion', '∩∩\nintersection', '~~\nnot\nwithout', ' ',
			'//\nreplicate\nReduce', '\\\\\n\expand\nScan', '⌿⌿\nreplicate first\nReduce First', '⍀⍀\nexpand first\nScan First', ' ', ',,\nravel\ncatenate/laminate',
			'⍪⍪\ntable\ncatenate first/laminate', '⍴⍴\nshape\nreshape', '⌽⌽\nreverse\nrotate', '⊖⊖\nreverse first\nrotate first',
			'⍉⍉\ntranspose\nreorder axes', ' ', '¨¨\nEach', '⍨⍨\nConstant\nSelf\nSwap', '⍣⍣\nRepeat\nUntil', '..\nOuter Product (∘.)\nInner Product',
			'∘∘\nOUTER PRODUCT (∘.)\nBind\nBeside', '⍤⍤\nRank\nAtop', '⍥⍥\nOver', '@@\nAt', ' ', '⍞⍞\nSTDIN\nSTDERR', '⎕⎕\nEVALUATED STDIN\nSTDOUT\nSYSTEM NAME PREFIX', '⍠⍠\nVariant',
			'⌸⌸\nIndex Key\nKey', '⌺⌺\nStencil', '⌶⌶\nI-Beam', '⍎⍎\nexecute', '⍕⍕\nformat', ' ', '⋄⋄\nSTATEMENT SEPARATOR', '⍝⍝\nCOMMENT', '→→\nABORT\nBRANCH', '⍵⍵\nRIGHT ARGUMENT\nRIGHT OPERAND (⍵⍵)', '⍺⍺\nLEFT ARGUMENT\nLEFT OPERAND (⍺⍺)',
			'∇∇\nrecursion\nRecursion (∇∇)', '&&\nSpawn', ' ', '¯¯\nNEGATIVE', '⍬⍬\nEMPTY NUMERIC VECTOR', '∆∆\nIDENTIFIER CHARACTER', '⍙⍙\nIDENTIFIER CHARACTER']
		, bqk = ' =1234567890-qwertyuiop\\asdfghjk∙l;\'zxcvbnm,./q[]+!@#$%^&*()_QWERTYUIOP|ASDFGHJKL:"ZXCVBNM<>?~{}'.replace(/∙/g, '')
		, bqv = '`÷¨¯<≤=≥>≠∨∧×⋄⍵∊⍴~↑↓⍳○*⊢∙⍺⌈⌊_∇∆∘\'⎕⍎⍕∙⊂⊃∩∪⊥⊤|⍝⍀⌿⋄←→⌹⌶⍫⍒⍋⌽⍉⊖⍟⍱⍲!⍰W⍷R⍨YU⍸⍥⍣⊣ASDF⍢H⍤⌸⌷≡≢⊆⊇CVB¤∥⍪⍙⍠⌺⍞⍬'.replace(/∙/g, '')
		, tc = {}, bqc = {} //tab completions and ` completions
	for (let i = 0; i < bqk.length; i++)bqc[bqk[i]] = bqv[i]
	for (let i = 0; i < tcs.length; i += 3)tc[tcs[i] + tcs[i + 1]] = tcs[i + 2]
	for (let i = 0; i < tcs.length; i += 3) { let k = tcs[i + 1] + tcs[i]; tc[k] = tc[k] || tcs[i + 2] }
	let lbh = ''; for (let i = 0; i < lbs.length; i++) {
		let ks = []
		for (let j = 0; j < tcs.length; j += 3)if (lbs[i][0] === tcs[j + 2]) ks.push('\n' + tcs[j] + ' ' + tcs[j + 1] + ' <tab>')
		for (let j = 0; j < bqk.length; j++)if (lbs[i][0] === bqv[j]) ks.push('\n` ' + bqk[j])
		lbh += '<b title="' + he(lbs[i].slice(1) + (ks.length ? '\n' + ks.join('') : '')) + '">' + lbs[i][0] + '</b>'
	}
	let ovl; try { ovl = localStorage.getItem('ngn_lb_overlay') === '1' } catch (e) { ovl = !1 } //overlay mode: bar covers the top instead of pushing the page down
	let d = document, el = d.createElement('div'); el.innerHTML =
		`<div class=ngn_lb><span class=ngn_x title=Close>❎</span><span class=ngn_o title="Toggle overlay/push-down">${ovl ? '▼' : '▲'}</span>${lbh}</div>
 <style>
  .ngn_lb{position:fixed;top:0;left:0;right:0;background-color:#eee;color:#000;cursor:default;z-index:2147483647;
    font-family:"DejaVu Sans Mono",monospace;border-bottom:solid #999 1px;padding:2px 2px 0 2px;word-wrap:break-word;}
  .ngn_lb b{cursor:pointer;padding:0 1px;font-weight:normal}
  .ngn_lb b:hover,.ngn_bq .ngn_lb{background-color:#777;color:#fff}
  .ngn_x,.ngn_o{float:right;color:#999;cursor:pointer;margin-top:-3px}
  .ngn_o{margin-right:6px}
  .ngn_o:hover{color:#00d}
  .ngn_x:hover{color:#f00}
  @media (prefers-color-scheme:dark){
   .ngn_lb{background-color:#222;color:#ddd;border-bottom-color:#555}
   .ngn_lb b:hover,.ngn_bq .ngn_lb{background-color:#bbb;color:#000}
   .ngn_x,.ngn_o{color:#666}
  }
 </style>`
	d.body.appendChild(el)
	let t, lb = el.firstChild, bqm = 0 //t:textarea or input, lb:language bar, bqm:backquote mode
	let pd = x => x.preventDefault()
	let ev = (x, t, f, c) => x.addEventListener(t, f, c)
	let med = _ => { try { return window.monaco?.editor?.getEditors?.().find(e => e.hasTextFocus()) } catch (e) { } } //focused Monaco editor, if any
	let ins = (t, s, del = 0) => { //insert s at caret (replacing selection, or del chars before it), keeping undo & input events
		let m = med()
		if (m) {
			if (del) {
				let p = m.getPosition()
				m.executeEdits('lb', [{ range: { startLineNumber: p.lineNumber, startColumn: p.column - del, endLineNumber: p.lineNumber, endColumn: p.column }, text: s }])
			} else m.trigger('keyboard', 'type', { text: s })
			return
		}
		if (!t || t.selectionStart == null) return
		if (del) t.selectionStart = t.selectionStart - del
		if (!(d.execCommand && d.execCommand('insertText', !1, s))) {
			let i = t.selectionStart
			t.value = t.value.slice(0, i) + s + t.value.slice(t.selectionEnd)
			t.selectionStart = t.selectionEnd = i + s.length
			t.dispatchEvent(new Event('input', { bubbles: !0 }))
		}
	}
	ev(lb, 'mousedown', x => {
		if (x.target.classList.contains('ngn_x')) { lb.hidden = 1; upd() }
		else if (x.target.classList.contains('ngn_o')) {
			ovl = !ovl
			x.target.textContent = ovl ? '▼' : '▲'
			try { localStorage.setItem('ngn_lb_overlay', ovl ? '1' : '0') } catch (e) { }
			upd()
		} else if (x.target.nodeName === 'B') {
			let s = x.target.textContent, m = med()
			if (m) { m.focus(); ins(t, s) }
			else if (t && t.selectionStart != null) { t.focus(); ins(t, s) }
		}
		pd(x) //always: clicking the bar must never steal focus
	})
	let fk = x => {
		let t = x.target, m = med(), i, v
		if (m) { let p = m.getPosition(); i = p.column - 1; v = m.getModel().getLineContent(p.lineNumber) }
		else { i = t.selectionStart; v = t.value }
		if (bqm) {
			let c = bqc[x.key]
			if (x.key === '`') {
				ins(t, '```')
				if (m) { let p = m.getPosition(); m.setPosition({ lineNumber: p.lineNumber, column: p.column - 2 }) }
				else t.selectionStart = t.selectionEnd = i + 1
				bqm = 0
				d.body.classList.remove('ngn_bq')
				pd(x)
				return !1
			}
			if (x.which > 31) { bqm = 0; d.body.classList.remove('ngn_bq') }
			if (c) { ins(t, c); pd(x); return !1 }
		}
		if (!x.ctrlKey && !x.shiftKey && !x.altKey && !x.metaKey) {
			if ("`½²^º§ùµ°".indexOf(x.key) > -1) {
				bqm = 1; d.body.classList.add('ngn_bq'); pd(x); // ` or other trigger symbol pressed, wait for next key
			} else if (x.key == "Tab") {
				let c = i >= 2 && tc[v.slice(i - 2, i)]
				if (c) { ins(t, c, 2); pd(x) }
			}
		}
	}
	let ff = x => {
		let t0 = x.target, nn = t0.nodeName.toLowerCase()
		if (nn !== 'textarea' && (nn !== 'input' || t0.type !== 'text' && t0.type !== 'search')) return
		t = t0; if (!t.ngn) { t.ngn = 1; ev(t, 'keydown', fk) }
	}
	let upd = _ => { d.body.style.paddingTop = ovl ? '' : lb.clientHeight + 'px' }
	upd(); (window.ResizeObserver ? new ResizeObserver(upd).observe(lb) : ev(window, 'resize', upd))
	ev(d, 'focus', ff, !0); let ae = d.activeElement; ae && ff({ type: 'focus', target: ae })
	ev(d, 'keydown', x => { if (!x.target.ngn && x.target.closest?.('.monaco-editor')) fk(x) }, !0) //EditContext-mode Monaco has no textarea for ff to register
})();

