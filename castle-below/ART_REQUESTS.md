# 新關卡素材需求

兩個新關卡（瞭望鐘樓、寶物夾）目前借用現有的擬真照片，已經可以完整遊玩。換上下列素材後，畫面就能達到其他關卡的水準。放進 `castle-below/assets/`，檔名照下表，告訴我一聲，我會量好物件座標並接上。

所有圖都要**擬真照片風格**，與城堡其他場景同一種光線和質感（暖色燭光、潮濕石材、老舊黃銅）。不要卡通、不要文字、不要浮水印。生成時可以直接把下面的英文描述貼給 ChatGPT。

## 1. 瞭望鐘樓：遠方城鎮全景（必要）

- 檔名：`lookout-town.webp`（或 .png）
- 尺寸：至少 3200 × 1800（16:9）。望遠鏡會放大 2.6 倍，解析度越高越清楚。
- 內容：從城堡高塔的石造陽台往外看，黃昏的中世紀城鎮。近景是陽台石欄杆，畫面左下可有一座黃銅望遠鏡支架。城鎮裡要有**很多可以清楚辨認、彼此分開**的東西，每樣只出現一次：

  鐘樓（有鐘面）、風車、河上的小船、石拱橋、市集的彩色帳篷、教堂尖塔、山坡上的羊群、果樹園、冒煙的麵包店煙囪、水井、城牆上的旗子、熱氣球、燈塔、在屋頂上的貓、晾在繩子上的衣服。

- 英文描述：

  > Photorealistic wide panorama at golden hour, seen from a stone balcony high in a medieval castle tower, looking over a detailed medieval town far below. Clearly separated, recognizable landmarks, each appearing once: a clock tower with a clock face, a windmill, small boats on a river, a stone arch bridge, colorful market tents in a square, a church spire, sheep on a green hillside, an orchard, a bakery chimney with smoke, a stone well, flags on the town wall, a hot air balloon in the sky, a lighthouse on the coast, a cat on a rooftop, laundry hanging on a line. Stone balustrade in the foreground, brass telescope on a stand at lower left. Warm sunlight, soft haze in the distance, no text, 16:9, very high detail.

## 2. 寶物夾：機台所在的房間（必要）

- 檔名：`grabber-room.webp`
- 尺寸：至少 2560 × 1440（16:9），正面視角，鏡頭與 Coji 背後視角同高（略高於地面）。
- 內容：燭光照亮的城堡藏寶室，正中央是一台古董「寶物夾」機台：深色木頭與黃銅框、玻璃正面、頂部有橫向黃銅軌道，右下角有出獎口。**機台內部要是空的**（獎品由遊戲畫上去），底部鋪深紅絨布。機台前方地板要留空間給 Coji。

- 英文描述：

  > Photorealistic front view of a candle-lit castle treasure room. In the center stands an antique claw-machine cabinet made of dark carved wood and aged brass, with a large clear glass front, a brass rail across the top inside, and a prize chute at the lower right. The inside of the cabinet is completely empty, with a deep red velvet floor. Stone walls, gold coins and chests in the shadows at the sides, warm candle light, wet stone floor in front with open space. No text, 16:9, very high detail.

## 3. 寶物夾：獎品（可選，建議）

目前的獎品是鑰匙、鐘、燈、鏡子、水晶與 Bebear。若想更像夾娃娃，可以加一組布偶：

- 檔名：`prize-owl.png`、`prize-bunny.png`、`prize-dragon.png`、`prize-cat.png`、`prize-duck.png`
- 規格：**透明背景 PNG**，每張高度 1024，物件置中，頭頂有一個布製掛環（掛鉤要勾的位置），正面、柔和頂光、底部不要陰影（遊戲會加）。
- 英文描述（每隻換動物）：

  > A single photorealistic plush toy owl, soft felt and fabric texture, with a small fabric loop sewn on top of its head, front view, soft top light, isolated on a transparent background, no shadow, no text.

## 4. 長廊上的兩扇門（可選）

- 檔名：`portal-lookout.png`、`portal-grabber.png`
- 規格：透明背景、384 × 384，畫風與 `hall-portals.webp` 中的門相同（華麗石框拱門正面）。瞭望鐘樓用星辰與望遠鏡主題，寶物夾用金幣與黃銅齒輪主題。

## 換圖之後我會做的事

1. 在 `scenes/annex-games.js` 的 `LOOKOUT_ART` 量出每個地標的位置（原圖座標），並依新地標重寫線索（`chamber-rules.js` 的 `lookoutClues`）。
2. 量出機台玻璃內部、軌道、出獎口的位置，讓掛鉤與獎品對齊照片裡的機台。
3. 更新長廊門的圖案與測試。
