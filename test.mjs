// node --test test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const k = require('./index.js');

const LONG = "Aha! Holt used Cheddar to steal the belt. But that's not Cheddar. "
    + 'Holt and Cheddar always walk in a perfect lockstep, which means '
    + 'someone took Cheddar, and that person has the belt. But who?';

/* -------------------------------------------------- 顯示什麼 */

test('短 cue 不切', () => {
    assert.deepEqual(k.chunkText('Short line.', 80), ['Short line.']);
});

test('長 cue 切成不超過上限的片段', () => {
    const chunks = k.chunkText(LONG, 80);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.ok(c.length <= 80, `${c.length} > 80: ${c}`);
});

// 曾經多找一格，把 42 字的上限變成 43、兩行擠成三行。
test('剛好等於上限時不會多切一個字', () => {
    const text = 'a'.repeat(100);
    for (const c of k.chunkText(text, 42)) assert.ok(c.length <= 42);
});

test('優先斷在句號，其次逗號，再其次詞間', () => {
    assert.ok(k.chunkText(LONG, 80)[0].endsWith('.'));
    assert.ok(k.chunkText('one, two, three, four, five, six, seven', 20)[0].endsWith(','));
    assert.ok(!k.chunkText('aaa bbb ccc ddd eee fff', 12)[0].endsWith(' '));
});

test('中文沒有空白也切得動', () => {
    const zh = '這是一段沒有任何空白字元的中文句子需要被切開才讀得完畢竟沒人想一次讀完';
    const chunks = k.chunkText(zh, 16);
    assert.ok(chunks.length > 1);
    assert.equal(chunks.join(''), zh.replace(/\s+/g, ''));
});

// 切片不能吃掉字：拼回去必須是原文（空白正規化後）。
test('切開再拼回去，一個字都沒少', () => {
    for (const max of [20, 42, 80, 120]) {
        const joined = k.chunkText(LONG, max).join(' ').replace(/\s+/g, ' ');
        assert.equal(joined, LONG.replace(/\s+/g, ' ').trim(), `max=${max}`);
    }
});

test('片段隨播放進度前進，不會倒退', () => {
    let last = -1;
    for (let i = 0; i <= 20; i++) {
        const v = k.visibleCue({ en: LONG, zh: '', progress: i / 20, widthPx: 600, fontSize: 30 });
        assert.ok(v.step >= last, `step 倒退於 ${i / 20}`);
        last = v.step;
    }
});

// 重複一行只是難看，一整句話消失不是。
test('較短的那一軌會重複而不是漏掉尾巴', () => {
    const seen = new Set();
    const zh = '第一句。第二句。';
    for (let i = 0; i < 40; i++) {
        const v = k.visibleCue({ en: LONG, zh, progress: i / 40, widthPx: 400, fontSize: 30 });
        if (v.zh) seen.add(v.zh);
    }
    const all = k.chunkText(zh, k.charsPerLine(400, 24, true) * 2);
    for (const piece of all) assert.ok(seen.has(piece), `沒顯示過：${piece}`);
});

test('progress 超出 0..1 不會炸也不會取到不存在的片', () => {
    for (const p of [-5, 0, 0.999, 1, 99, NaN, undefined]) {
        const v = k.visibleCue({ en: LONG, zh: '', progress: p, widthPx: 600, fontSize: 30 });
        assert.equal(typeof v.en, 'string');
        assert.ok(v.en.length > 0);
    }
});

test('cueProgress 把時間換成 0..1 並夾住', () => {
    const cue = { start: 10, end: 20 };
    assert.equal(k.cueProgress(cue, 10), 0);
    assert.equal(k.cueProgress(cue, 15), 0.5);
    assert.ok(k.cueProgress(cue, 99) < 1);
    assert.equal(k.cueProgress(cue, 0), 0);
    assert.equal(k.cueProgress({ start: 5, end: 5 }, 5), 0);  // 零長度不除以零
    assert.equal(k.cueProgress(null, 5), 0);
});

test('底線位移跟著片段走，對不上時寧可不標', () => {
    const word = 'lockstep';
    const at = LONG.indexOf(word);
    const marks = [{ start: at, end: at + word.length, word }];
    const piece = 'Holt and Cheddar always walk in a perfect lockstep,';
    const out = k.marksForChunk(marks, LONG, piece);
    assert.equal(piece.slice(out[0].start, out[0].end), word);
    assert.deepEqual(k.marksForChunk(marks, LONG, '不在原文裡的片段'), []);
    assert.deepEqual(k.marksForChunk(null, LONG, piece), []);
});

test('一行幾個字：CJK 約為拉丁的一半，字體比例可注入', () => {
    assert.ok(k.charsPerLine(800, 20, false) > k.charsPerLine(800, 20, true));
    assert.ok(k.charsPerLine(800, 20, false, 0.4) > k.charsPerLine(800, 20, false, 0.8));
    assert.equal(k.charsPerLine(0, 20, false), 6);      // 還沒量到寬度
    assert.equal(k.charsPerLine(800, 0, false), 6);     // 字級為零
});

test('maxLines 可調，三行比兩行塞得多', () => {
    const two = k.visibleCue({ en: LONG, zh: '', progress: 0, widthPx: 500, fontSize: 30, maxLines: 2 });
    const three = k.visibleCue({ en: LONG, zh: '', progress: 0, widthPx: 500, fontSize: 30, maxLines: 3 });
    assert.ok(three.en.length > two.en.length);
    assert.ok(three.steps <= two.steps);
});

/* -------------------------------------------------- 放在哪 */

const area = { boxHeight: 60, areaHeight: 600 };

test('錨邊與絕對座標可以互換', () => {
    assert.equal(k.anchorToTop({ position: 'bottom', offset: 76, ...area }), 464);
    assert.equal(k.anchorToTop({ position: 'top', offset: 40, ...area }), 40);
    for (const top of [0, 17, 180, 299, 301, 420, 540]) {
        const stored = k.dropAnchor({ top, ...area });
        assert.equal(k.anchorToTop({ ...stored, ...area }), top, `來回不一致於 ${top}`);
    }
});

test('落在上半掛上緣、下半掛下緣', () => {
    assert.deepEqual(k.dropAnchor({ top: 40, ...area }), { position: 'top', offset: 40 });
    assert.deepEqual(k.dropAnchor({ top: 464, ...area }), { position: 'bottom', offset: 76 });
});

test('拖不出畫面，也不會產生負的位移', () => {
    assert.equal(k.clampTop({ top: -200, ...area }), 0);
    assert.equal(k.clampTop({ top: 9999, ...area }), 540);
    assert.equal(k.clampTop({ top: NaN, ...area }), 0);
    assert.deepEqual(k.dropAnchor({ top: 9999, ...area }), { position: 'bottom', offset: 0 });
    const tall = { boxHeight: 800, areaHeight: 600 };
    assert.equal(k.dropAnchor({ top: 100, ...tall }).offset, 0);
});

// 視窗變矮後，存起來的位移可能已經把框推出畫面。
test('fitInside 把被擠出去的框拉回畫面內', () => {
    const stored = { position: 'top', offset: 600, boxHeight: 90 };
    const fixed = k.fitInside({ ...stored, areaHeight: 400 });
    const top = k.anchorToTop({ ...fixed, boxHeight: 90, areaHeight: 400 });
    assert.ok(top >= 0 && top <= 400 - 90, `回不到畫面內：top=${top}`);
    assert.ok(fixed.offset >= 0);
});

test('fitInside 對本來就合法的位置不動手', () => {
    const ok = { position: 'bottom', offset: 76, boxHeight: 60, areaHeight: 600 };
    assert.deepEqual(k.fitInside(ok), { position: 'bottom', offset: 76 });
});

/* -------------------------------------------------- 多大 */

test('拉一邊，框從兩邊一起變寬', () => {
    assert.equal(k.widthPctFrom({ pointerX: 900, centreX: 500, areaWidth: 1000 }), 80);
    assert.equal(k.widthPctFrom({ pointerX: 100, centreX: 500, areaWidth: 1000 }), 80);
});

test('寬度夾在可讀下限與滿版之間，沒量到寬度不除以零', () => {
    assert.equal(k.widthPctFrom({ pointerX: 505, centreX: 500, areaWidth: 1000 }), k.MIN_WIDTH_PCT);
    assert.equal(k.widthPctFrom({ pointerX: 5000, centreX: 500, areaWidth: 1000 }), k.MAX_WIDTH_PCT);
    assert.equal(k.widthPctFrom({ pointerX: 900, centreX: 500, areaWidth: 0 }), k.MAX_WIDTH_PCT);
});

test('四角等比：框與字同倍率', () => {
    assert.deepEqual(
        k.scaleFrom({ pointerX: 900, centreX: 500, startHalfWidth: 200, startWidthPct: 40, startFont: 20 }),
        { widthPct: 80, fontSize: 40 }
    );
    assert.deepEqual(
        k.scaleFrom({ pointerX: 700, centreX: 500, startHalfWidth: 200, startWidthPct: 81, startFont: 36 }),
        { widthPct: 81, fontSize: 36 }
    );
});

// 讓其中一個先撞到上限、另一個繼續長，正是「等比」不再等比的地方。
test('撞到上限時兩者一起停，比例不破', () => {
    const wide = k.scaleFrom({ pointerX: 99999, centreX: 500, startHalfWidth: 200, startWidthPct: 50, startFont: 20 });
    assert.equal(wide.widthPct, k.MAX_WIDTH_PCT);
    assert.equal(wide.fontSize, 20 * (k.MAX_WIDTH_PCT / 50));

    const tallFont = k.scaleFrom({ pointerX: 99999, centreX: 500, startHalfWidth: 200, startWidthPct: 30, startFont: 60 });
    assert.equal(tallFont.fontSize, k.MAX_FONT);
    assert.ok(tallFont.widthPct < k.MAX_WIDTH_PCT);
    assert.equal(tallFont.widthPct, Math.round(30 * (k.MAX_FONT / 60)));
});

test('拖到中心線不會縮成零', () => {
    const r = k.scaleFrom({ pointerX: 500, centreX: 500, startHalfWidth: 200, startWidthPct: 80, startFont: 36 });
    assert.ok(r.widthPct >= k.MIN_WIDTH_PCT);
    assert.ok(r.fontSize >= k.MIN_FONT);
});

// 位移量到的是框的近邊，最後一個框高的行程會把它推到看不見。
test('垂直上限停在框要離開畫面之前，而且跟著畫面高度走', () => {
    assert.equal(k.maxOffsetFor({ areaHeight: 845, fontSize: 29 }), 748);
    assert.ok(k.maxOffsetFor({ areaHeight: 1200, fontSize: 29 })
        > k.maxOffsetFor({ areaHeight: 600, fontSize: 29 }));
    assert.ok(k.maxOffsetFor({ areaHeight: 300, fontSize: 90 }) >= 120);
});

test('點擊與拖曳的門檻夠小，不會吃掉點字查單字', () => {
    assert.ok(k.DRAG_THRESHOLD > 0 && k.DRAG_THRESHOLD <= 8);
});
