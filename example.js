'use strict';

// node example.js — 不需要瀏覽器，全部是純函式。

var k = require('./index.js');

console.log('— 1. 一條六句話的 cue，切成讀得完的片段 —\n');

var cue = {
  start: 721,
  end: 735,
  text: "Aha! Holt used Cheddar to steal the belt. But that's not Cheddar. "
      + 'Holt and Cheddar always walk in a perfect lockstep, which means '
      + 'someone took Cheddar, and that person has the belt. But who?',
  zh: '啊哈！Holt 用 Cheddar 偷走了腰帶。但那不是 Cheddar。Holt 跟 Cheddar '
    + '走路永遠完全同步，所以是別人把 Cheddar 帶走了，而那個人拿了腰帶。是誰？'
};

var box = { widthPx: 820, fontSize: 30 };

console.log('整段 ' + cue.text.length + ' 字，直接畫上去是一片告示牌。\n');

for (var i = 0; i < 6; i++) {
  var t = cue.start + (cue.end - cue.start) * (i / 6);
  var piece = k.visibleCue({
    en: cue.text,
    zh: cue.zh,
    progress: k.cueProgress(cue, t),
    widthPx: box.widthPx,
    fontSize: box.fontSize
  });
  console.log('  t=' + t.toFixed(1) + 's  [' + (piece.step + 1) + '/' + piece.steps + ']');
  console.log('    EN  ' + piece.en);
  console.log('    ZH  ' + piece.zh);
}

console.log('\n— 2. 難字底線跟著片段走 —\n');

var word = 'lockstep';
var marks = [{ start: cue.text.indexOf(word), end: cue.text.indexOf(word) + word.length, word: word }];
for (var j = 0; j < 3; j++) {
  var p = k.visibleCue({
    en: cue.text, zh: '', progress: j / 3,
    widthPx: box.widthPx, fontSize: box.fontSize, marks: marks
  });
  var shown = p.marks.length
    ? '底線在「' + p.en.slice(p.marks[0].start, p.marks[0].end) + '」'
    : '這片沒有要標的字';
  console.log('  [' + (p.step + 1) + '/' + p.steps + '] ' + shown);
}

console.log('\n— 3. 拖到畫面上半部，錨邊自己換到 top —\n');

var area = { boxHeight: 90, areaHeight: 720 };
var stored = { position: 'bottom', offset: 76 };
console.log('  存的是 ' + JSON.stringify(stored)
  + ' → 絕對位置 top=' + k.anchorToTop(Object.assign({}, stored, area)));

var dropped = k.dropAnchor(Object.assign({ top: 40 }, area));
console.log('  拖到 top=40 放開 → ' + JSON.stringify(dropped)
  + '（掛上緣，視窗變矮才不會整個往下滑）');

console.log('  拖出畫面 top=9999 → ' + JSON.stringify(k.dropAnchor(Object.assign({ top: 9999 }, area))));

console.log('\n— 4. 視窗變矮，原本的位移已經把框推出去 —\n');
var tall = { position: 'top', offset: 600, boxHeight: 90, areaHeight: 720 };
console.log('  720 高時 → ' + JSON.stringify(k.fitInside(tall)));
tall.areaHeight = 400;
console.log('  變成 400 高 → ' + JSON.stringify(k.fitInside(tall)) + '（自己回到畫面內）');

console.log('\n— 5. 側邊只改寬度，四角整體等比 —\n');

console.log('  側邊拖到距中心 400（畫面寬 1000）→ widthPct='
  + k.widthPctFrom({ pointerX: 900, centreX: 500, areaWidth: 1000 }));

var before = { widthPct: 40, startFont: 20 };
var after = k.scaleFrom({
  pointerX: 900, centreX: 500, startHalfWidth: 200,
  startWidthPct: before.widthPct, startFont: before.startFont
});
console.log('  四角拖成兩倍 → ' + JSON.stringify(after)
  + '（寬 x' + (after.widthPct / before.widthPct)
  + '、字 x' + (after.fontSize / before.startFont) + '，一致）');

var bound = k.scaleFrom({
  pointerX: 99999, centreX: 500, startHalfWidth: 200,
  startWidthPct: 30, startFont: 60
});
console.log('  拖到天邊（字級先撞頂）→ ' + JSON.stringify(bound)
  + '  字級上限=' + k.MAX_FONT + '，寬度跟著停在 ' + bound.widthPct + '% 而不是 100%');

console.log('\n— 6. 垂直滑桿該停在哪 —\n');
console.log('  畫面 845 高、字級 29 → max=' + k.maxOffsetFor({ areaHeight: 845, fontSize: 29 })
  + '（寫死 400 的話，桌機視窗根本拉不到上面）');
