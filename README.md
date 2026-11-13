<p align="center">
  <img src="logo.svg" width="96" height="96" alt="subtitle-overlay-kit logo">
</p>

# subtitle-overlay-kit 🎬

字幕**怎麼顯示在影片上**的純邏輯。零依賴、不碰 DOM、不認識播放器。

只回答兩個問題：

1. **這一刻該顯示哪段文字？** — 轉錄吐出來的 cue 常常是一整段對話（六個句子、兩百個字）。整段畫上去就是畫面中央一片七行的告示牌；縮小字級只是變成小字的告示牌。必須把 cue 切開，每片各佔這個 cue 自己時間的一份。
2. **那個框該放在哪、多大？** — 錨邊 + 位移、寬度、四角等比縮放，以及視窗變形後把跑出去的框拉回來。

同一顆 kit 的理由：這兩件事互相咬合。「一行放得下幾個字」要先知道框多寬，而框多寬是幾何的事。

## 安裝

```bash
npm i github:Jeffrey0117/subtitle-overlay-kit
```

或直接內嵌 `index.js`（單檔、零依賴、CommonJS）。使用者腳本/擴充環境建議內嵌。

## 最小接線

```js
const {
  visibleCue, cueProgress,
  anchorToTop, dropAnchor, fitInside,
  widthPctFrom, scaleFrom, maxOffsetFor,
  DRAG_THRESHOLD
} = require('subtitle-overlay-kit');

// --- 每次 timeupdate：決定這一刻顯示什麼 ---
video.addEventListener('timeupdate', () => {
  const cue = findCueAt(video.currentTime);        // 你的字幕來源
  if (!cue) return hideBox();

  const piece = visibleCue({
    en: cue.text,
    zh: cue.zh,
    progress: cueProgress(cue, video.currentTime),
    widthPx: boxInnerWidth,                        // 框的可用文字寬度
    fontSize: style.fontSize,
    marks: difficultWords[cue.index],              // 可省略
    maxLines: 2                                    // 手機 2、大螢幕可 3
  });

  enEl.textContent = piece.en;
  zhEl.textContent = piece.zh;
  underline(piece.marks);   // 已經換算成 piece.en 的座標
});
```

### 位置：存的是「哪一邊 + 距離多遠」

CSS 要的是這個，而且視窗改變大小時它才撐得住。拖曳用絕對 `top`，所以需要互換：

```js
// 按下去
const top = anchorToTop({
  position: style.position, offset: style.offset,
  boxHeight: box.offsetHeight, areaHeight: player.clientHeight
});

// 放開
const next = dropAnchor({ top: draggedTop, boxHeight, areaHeight });
save({ ...style, ...next });   // → { position: 'top'|'bottom', offset }
```

`dropAnchor` 讓框**落在哪半邊就掛哪邊**。這不是美觀問題：停在畫面上緣卻存成「距離下緣 N」的字幕，視窗一變矮就會往下滑過整個畫面。

視窗改變大小之後呼叫一次 `fitInside`，把已經被擠出畫面的框拉回來：

```js
window.addEventListener('resize', () => {
  save({ ...style, ...fitInside({ ...style, boxHeight, areaHeight }) });
});
```

### 大小：側邊只改寬度，四角整體等比

跟任何編輯器一樣。側邊拉寬度，四角連背景帶文字一起縮放：

```js
// 側邊
onMove = (e) => setWidth(widthPctFrom({
  pointerX: e.clientX, centreX: areaRect.left + areaRect.width / 2,
  areaWidth: areaRect.width
}));

// 四角
onMove = (e) => setStyle(s => ({ ...s, ...scaleFrom({
  pointerX: e.clientX, centreX, startHalfWidth, startWidthPct, startFont
}) }));
```

比例是**先夾再套用**，不是寬度和字級各自夾——讓其中一個先撞到上限、另一個繼續長，正是「等比」不再等比的原因，然後文字就爬出自己的框了。

### 兩個容易踩的細節

- **框要用 `width` 不是 `maxWidth`。** 用 `maxWidth` 的話框仍會縮到貼合文字，於是「拉寬度」在短句上看起來完全沒反應。順帶一提，固定寬度也讓背景不再隨每句話長短抽動。
- **垂直滑桿的上限用 `maxOffsetFor()`，別寫死。** 位移量到的是框的近邊，所以上限要停在「框會開始離開畫面」的地方；寫死一個跟畫面高度無關的數字，在大視窗上就會拉不到上緣。

```html
<input type="range" min="0" max={maxOffsetFor({ areaHeight, fontSize })} />
```

## 點擊 vs 拖曳

字幕上的字通常要可以點（查單字）。用 `DRAG_THRESHOLD` 區分：按下到放開之間移動超過它才算拖曳，否則是點擊。

```js
if (Math.abs(e.clientY - grabY) > DRAG_THRESHOLD) moved = true;
// 放開時：moved 為真就只存位置，不要同時觸發查字
```

## API

**顯示什麼**

| | |
|---|---|
| `visibleCue({en, zh, progress, widthPx, fontSize, marks?, maxLines?, latinRatio?})` | → `{ en, zh, marks, step, steps }` |
| `cueProgress(cue, currentTime)` | → `0..0.999` |
| `chunkText(text, maxChars)` | → `string[]`，斷在句號 > 逗號 > 詞間 > 字元 |
| `chunkAt(chunks, progress)` | → `string` |
| `charsPerLine(widthPx, fontSize, cjk, latinRatio?)` | CJK 約為拉丁兩倍寬 |
| `marksForChunk(marks, text, chunk)` | 位移換算到片段座標；對不上回 `[]` |

**放在哪**

| | |
|---|---|
| `anchorToTop({position, offset, boxHeight, areaHeight})` | → 絕對 `top` |
| `dropAnchor({top, boxHeight, areaHeight})` | → `{position, offset}` |
| `fitInside({position, offset, boxHeight, areaHeight})` | 視窗變形後拉回畫面內 |
| `clampTop({top, boxHeight, areaHeight})` | |

**多大**

| | |
|---|---|
| `widthPctFrom({pointerX, centreX, areaWidth})` | → `20..100` |
| `scaleFrom({pointerX, centreX, startHalfWidth, startWidthPct, startFont})` | → `{widthPct, fontSize}` |
| `maxOffsetFor({areaHeight, fontSize})` | 垂直滑桿上限 |

常數：`DRAG_THRESHOLD` `MIN_WIDTH_PCT` `MAX_WIDTH_PCT` `MIN_FONT` `MAX_FONT` `DEFAULT_MAX_LINES`

## 跟其他 kit 的縫

- **bilingual-subtitle-kit** — 負責 parse / 翻譯 / 找出當下的 cue。本 kit 接手它吐出來的 `{start, end, text, zh}` 決定顯示什麼、放哪裡。
- **video-core-kit** — 負責把 HLS/DASH/MP4 接上 `<video>` 並發進度事件。本 kit 只吃一個 `0..1` 的數字，不認識播放器。

三顆串起來就是「一個能在桌面、使用者腳本、瀏覽器擴充裡長同樣臉的字幕播放器」。

```bash
node example.js    # 六個情境，不需要瀏覽器
node --test test.mjs
```

MIT
