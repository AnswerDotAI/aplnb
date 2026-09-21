# Release notes

<!-- do not remove -->

## 0.3.1

### New Features

- Add prime glyph support and improve glyph name matching with hyphen-aware abbreviations ([#13](https://github.com/AnswerDotAI/aplnb/issues/13))


## 0.3.0

### New Features

- Add left Alt/Option glyph chords using BasedPL shared keyboard layout for APL input ([#11](https://github.com/AnswerDotAI/aplnb/issues/11))
- Replace Dyalog RIDE backend with BasedPL session for apl magics, moving RIDE support to aplnb.dyalog, and add symbol-name input completion ([#10](https://github.com/AnswerDotAI/aplnb/issues/10))
- remove J and rename ([#9](https://github.com/AnswerDotAI/aplnb/issues/9))


## 0.2.0

### New Features

- Rename aplnb to iversonnb and add J language support via libj ([#8](https://github.com/AnswerDotAI/iversonnb/issues/8))
- Add `aplkernel` clikernel/MCP worker for persistent APL sessions, and track interpreter resets via `AplError.reset` with socket timeout lifted after startup ([#7](https://github.com/AnswerDotAI/iversonnb/issues/7))


## 0.1.0

### New Features

- Replace pynapl dependency with native RIDE protocol client ([#3](https://github.com/AnswerDotAI/aplnb/issues/3))
- Add Pythonic Apl API (`__call__`, `__getitem__`, `__setitem__`, fn, context manager), rewrite README, and improve lb.js (dark mode, overlay toggle, Monaco support) ([#4](https://github.com/AnswerDotAI/aplnb/issues/4))
- Render APL output in SAX2 font via `_repr_html_` instead of plain print ([#5](https://github.com/AnswerDotAI/aplnb/issues/5))
- Support APL comments ([#2](https://github.com/AnswerDotAI/aplnb/issues/2))
- add lb.js ([#1](https://github.com/AnswerDotAI/aplnb/issues/1))

### Bugs Squashed

- Set body padding instead of margin ([#6](https://github.com/AnswerDotAI/aplnb/pull/6)), thanks to [@curtis-allan](https://github.com/curtis-allan)


## 0.0.1

- Init release
