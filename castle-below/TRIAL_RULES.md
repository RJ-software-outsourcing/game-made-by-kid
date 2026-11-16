# Coji and the Castle Below：英文關卡規則庫 v0.1

> 對象：康橋一年級英文程度
> 用途：定義六種閱讀試煉的首批可測試規則
> 狀態：企劃與語句測試階段，尚未實作

---

## 1. 共通語言原則

- 每張規則卡使用 1–2 句英文。
- 每句原則上 4–10 個單字；兩句規則一次只增加一個新概念。
- 先使用孩子熟悉的動詞：stand, walk, move, stop, touch, open, follow, give。
- 顏色、數字、大小、左右、常見物品與 first / then / last 是主要變化來源。
- 第 1 層只用 A 級規則；第 2–3 層可用 A、B；第 4 層才可用 C。
- 同一場最多出現兩個 `do not` 規則，且不能連續出現。
- 畫面中的正確答案必須唯一。產生房間時，文字與場景資料來自同一份設定。
- 不提供朗讀、中文翻譯或答案圖示。玩家可以隨時重新打開原始英文規則。
- 下面的「場景條件」是規則成立的必要條件，不符合時不得抽到該規則。

### 難度標記

| 等級 | 建議樓層 | 語言結構 |
|---|---|---|
| A | 第 1–2 層 | 一個動作加一個特徵 |
| B | 第 2–3 層 | 順序、位置或簡單時間條件 |
| C | 第 4 層 | 排除、兩步驟或兩個資訊來源 |

---

## 2. 關卡一：岩漿長廊

### 共通玩法

- 場地為 3 格寬、8–10 格長的通道，玩家走到對岸出口才算成功。
- 每次危險開始時大喊並顯示 **FLOOR IS LAVA!**。
- 喊聲後有約 1.2 秒預警，錯誤格才變成岩漿。
- 踩錯只退回最近檢查點，不扣生命。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| LAVA-01 | A | `Stand on a blue tile.` | 每個檢查區都有一格藍色 | 每次爆發時站在藍格 |
| LAVA-02 | A | `Stand on a moon.` | 每個檢查區都有一個月亮 | 站在月亮圖案上 |
| LAVA-03 | A | `Walk on stars.` | 星星形成一條連續路線 | 只沿星星格前進 |
| LAVA-04 | A | `Do not touch a shield.` | 非盾牌格形成可走路線 | 避開所有盾牌格 |
| LAVA-05 | B | `The torch shows the safe color.` | 火把會在每輪顯示一種顏色 | 站上和火把同色的格子 |
| LAVA-06 | B | `The crystal shows the safe shape.` | 水晶輪流顯示月亮、星星或盾牌 | 站上和水晶同圖案的格子 |
| LAVA-07 | B | `Stand on red after the bell rings.` | 鐘聲在爆發前響起，紅格唯一 | 聽到鐘後移到紅格 |
| LAVA-08 | B | `When you hear “Floor is lava,” stand on green.` | 每區都有綠格 | 喊聲後移到綠格 |
| LAVA-09 | B | `Walk on stars. Stop on a moon.` | 星星是路線，月亮是檢查點 | 沿星星走，爆發時停在月亮 |
| LAVA-10 | C | `Follow the torch first. Then follow the crystal.` | 前半有火把，後半有水晶 | 前半依火把顏色，後半依水晶圖案 |
| LAVA-11 | C | `Blue is safe first. Red is safe after the bell.` | 鐘聲只在後半響一次 | 前半站藍格，鐘後改站紅格 |
| LAVA-12 | C | `Do not stand on red. Follow the moon signs.` | 月亮路線不包含紅格 | 避開紅格並沿月亮前進 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 石板裂開並冒出岩漿 | 甲板裂縫噴出綠色鬼火 | 反應爐地板噴出橙色電漿 |
| 火把與魔法水晶 | 船燈與羅盤水晶 | 警示燈與全息核心 |
| 石橋出口 | 上層艙門 | 安全氣閘門 |

---

## 3. 關卡二：封印之門

### 共通玩法

- 房間中有 2–3 扇門與 0–3 個符文。
- 點擊目標會由 Coji 發射一顆無傷害的小光球啟動，不需要走近。
- 選錯時黑煙或蒸氣把 Coji 推回起點，門的位置重新排列，規則不變。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| DOOR-01 | A | `Open the door with a moon.` | 只有一扇月亮門 | 點月亮門 |
| DOOR-02 | A | `Open the blue door.` | 三扇門顏色不同 | 點藍門 |
| DOOR-03 | A | `Open the middle door.` | 三扇門清楚並排 | 點中門 |
| DOOR-04 | A | `Open the door under the star.` | 只有一扇門上方有星星 | 點星星下方的門 |
| DOOR-05 | B | `Open the door beside the blue torch.` | 只有一扇門鄰接藍火把 | 點藍火把旁的門 |
| DOOR-06 | B | `Open the door on the right.` | 三扇門清楚並排 | 點右門 |
| DOOR-07 | B | `Touch the red rune. Then open the moon door.` | 有唯一紅符文與月亮門 | 先點紅符文，再點月亮門 |
| DOOR-08 | B | `Touch the small key. Then open the gold door.` | 大小鑰匙各一，只有一扇金門 | 先點小鑰匙，再點金門 |
| DOOR-09 | B | `Open the sun door after the bell rings.` | 有太陽門，鐘聲會在數秒後響 | 等鐘響再點太陽門 |
| DOOR-10 | C | `Do not open the red door. Open the star door.` | 紅門與星門是不同門 | 點星門，不碰紅門 |
| DOOR-11 | C | `Touch the shield first. Then open the door on the left.` | 唯一盾符文，三門並排 | 先點盾，再點左門 |
| DOOR-12 | C | `The blue rune is a trap. Touch green, then open gold.` | 藍綠符文各一，只有一扇金門 | 避開藍符文，點綠符文後開金門 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 石製封印門 | 船艙門與船長鎖 | 氣閘門與門禁面板 |
| 魔法符文 | 發光航海印記 | 全息按鈕 |
| 黑煙推回 | 海風與水霧推回 | 安全力場推回 |

---

## 4. 關卡三：守衛交付

### 共通玩法

- 入口有 2–3 件物品，對面有 2–3 名特徵清楚的守衛。
- 點物品後物品漂浮在 Coji 身邊，再點守衛完成交付。
- 交錯對象時守衛搖頭，物品飛回原位，不扣生命。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| GIVE-01 | A | `Give the key to the blue knight.` | 只有一把鑰匙與一名藍騎士 | 把鑰匙交給藍騎士 |
| GIVE-02 | A | `Give the book to the tall guard.` | 守衛高度差明顯 | 把書交給高守衛 |
| GIVE-03 | A | `Give the shield to the king.` | 國王外觀唯一 | 把盾交給國王 |
| GIVE-04 | A | `Give the red gem to the ghost.` | 紅寶石唯一，幽靈唯一 | 把紅寶石交給幽靈 |
| GIVE-05 | B | `Take the gold key. Give it to the knight in blue.` | 金銀鑰匙各一，披風顏色不同 | 把金鑰匙交給藍披風騎士 |
| GIVE-06 | B | `Give the small book to the tall guard.` | 大小書各一，守衛高度不同 | 把小書交給高守衛 |
| GIVE-07 | B | `Give the silver key to the guard on the right.` | 金銀鑰匙各一，守衛並排 | 把銀鑰匙交給右邊守衛 |
| GIVE-08 | B | `Give the star to the guard with a moon.` | 星星物品唯一，月亮徽章唯一 | 把星星交給月亮守衛 |
| GIVE-09 | B | `Give the blue gem to the small ghost.` | 寶石顏色不同，幽靈大小不同 | 把藍寶石交給小幽靈 |
| GIVE-10 | C | `Do not give the key to the red knight. Give it to blue.` | 只有紅、藍兩名騎士 | 把鑰匙交給藍騎士 |
| GIVE-11 | C | `First, give the book to the ghost. Then, give the key to the king.` | 書、鑰匙、幽靈、國王皆唯一 | 依序完成兩次交付 |
| GIVE-12 | C | `Give the moon to the left guard. Give the star to the right guard.` | 月亮、星星各一，兩守衛並排 | 將兩物品交給指定位置的守衛 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 騎士、國王、幽靈 | 水手、船長、幽靈海盜 | 機器人、工程師投影、外星生物 |
| 鑰匙、盾、書、寶石 | 船鑰匙、羅盤、地圖、珍珠 | 能源卡、工具、資料板、核心 |
| 王室徽章 | 船旗圖案 | 星艦部門標誌 |

---

## 5. 關卡四：魔眼走廊

### 共通玩法

- 走廊分成 5–6 段，每段末端有一條安全線。
- 點下一條安全線開始移動；按住 Coji 會立刻停下並展開防護罩。
- 在錯誤狀態移動時，魔眼將 Coji 推回上一條安全線。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| EYE-01 | A | `Move when the eye is open.` | 一顆眼睛，開閉節奏緩慢 | 張眼時移動 |
| EYE-02 | A | `Move when the eye is closed.` | 一顆眼睛，開閉節奏緩慢 | 閉眼時移動 |
| EYE-03 | A | `Stop when the eye turns red.` | 眼睛在藍、紅間切換 | 紅色時按住 Coji |
| EYE-04 | A | `Move when the light is green.` | 指示燈在紅、綠間切換 | 綠燈時移動 |
| EYE-05 | B | `Move when the blue eye is open.` | 藍、綠兩眼不同步 | 只依藍眼狀態移動 |
| EYE-06 | B | `Watch the small eye. Move when it closes.` | 大小兩眼不同步 | 只依小眼，閉眼時移動 |
| EYE-07 | B | `Move when the bell is quiet.` | 鐘聲規律響起與停止 | 沒有鐘聲時移動 |
| EYE-08 | B | `Move after the bell. Stop when the eye opens.` | 鐘響後眼睛稍晚張開 | 鐘響後前進，張眼時停下 |
| EYE-09 | B | `Do not move when the eye is gold.` | 眼睛在藍、金間切換 | 金色時保持停止 |
| EYE-10 | C | `Move when both eyes are closed.` | 兩眼偶爾同時閉上 | 兩眼皆閉時移動 |
| EYE-11 | C | `Watch the green eye. The red eye is a trap.` | 紅綠眼不同步 | 完全忽略紅眼，只依綠眼開閉 |
| EYE-12 | C | `Move when blue is open. Move when red is closed.` | 前半藍眼、後半紅眼 | 前半依藍眼張開，後半依紅眼閉上 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 牆上巨大魔眼 | 會轉頭的船長畫像與燈籠眼 | 監視鏡頭與掃描器 |
| 魔法光束推回 | 海風推回 | 安全掃描力場推回 |
| 石製安全線 | 黃銅甲板線 | 發光地面線 |

---

## 6. 關卡五：幽靈隊伍

### 共通玩法

- 四名角色依序登場，最後全部並排留在畫面中。
- 玩家點擊要跟隨的角色；選對後它會帶 Coji 前往出口。
- 使用順序字時，地面保留淡淡的 1、2、3、4，避免變成記憶測驗。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| GHOST-01 | A | `Follow the ghost with a lantern.` | 只有一隻有燈籠 | 點燈籠幽靈 |
| GHOST-02 | A | `Follow the blue ghost.` | 幽靈顏色不同 | 點藍幽靈 |
| GHOST-03 | A | `Follow the tall ghost.` | 高度差明顯 | 點高幽靈 |
| GHOST-04 | A | `Follow the ghost with a key.` | 只有一隻有鑰匙 | 點鑰匙幽靈 |
| GHOST-05 | B | `Follow the first ghost.` | 保留出場數字 | 點第一隻 |
| GHOST-06 | B | `Follow the second ghost.` | 保留出場數字 | 點第二隻 |
| GHOST-07 | B | `Follow the last ghost.` | 保留出場數字 | 點第四隻 |
| GHOST-08 | B | `Follow the small blue ghost.` | 藍幽靈有大、小兩隻 | 點小藍幽靈 |
| GHOST-09 | B | `Follow the ghost on the right.` | 四隻並排且間距清楚 | 點最右幽靈 |
| GHOST-10 | C | `Do not follow the ghost with a crown. Follow the one with a key.` | 王冠與鑰匙在不同角色身上 | 點鑰匙幽靈 |
| GHOST-11 | C | `Two ghosts have hats. Follow the tall one.` | 兩隻戴帽，高度不同 | 點戴帽的高幽靈 |
| GHOST-12 | C | `Follow the last ghost with a lantern.` | 兩隻有燈籠且出場順序不同 | 點較晚出場的燈籠幽靈 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 城堡幽靈 | 幽靈船員 | 故障人員全息投影 |
| 燈籠、鑰匙、王冠、帽子 | 船燈、船鑰匙、船長帽、羅盤 | 掃描燈、門卡、頭盔、工具 |
| 幽靈門 | 霧中艙門 | 全息出口 |

---

## 7. 關卡六：低語雕像

### 共通玩法

- 左、右各有一條短橋，三座雕像指出不同方向。
- 玩家先點選要相信的雕像，再點它指出的橋。
- 選錯時橋面只在 Coji 前方裂開，不讓角色真的墜落。

### 首批 12 組規則

| ID | 級別 | 顯示的英文規則 | 場景條件 | 正確行動 |
|---|---|---|---|---|
| STATUE-01 | A | `Follow the blue statue.` | 三座雕像顏色不同 | 走藍雕像指的橋 |
| STATUE-02 | A | `Follow the statue with a sword.` | 只有一座持劍 | 走持劍雕像指的橋 |
| STATUE-03 | A | `Follow the tall statue.` | 高度差明顯 | 走高雕像指的橋 |
| STATUE-04 | A | `Follow the statue on the left.` | 三座並排 | 走左雕像指的橋 |
| STATUE-05 | B | `Follow the statue with a gold sword.` | 兩座持劍但顏色不同 | 走持金劍雕像指的橋 |
| STATUE-06 | B | `Follow the statue holding a shield.` | 只有一座持盾 | 走持盾雕像指的橋 |
| STATUE-07 | B | `Follow the statue beside the blue flame.` | 只有一座鄰接藍火 | 走藍火旁雕像指的橋 |
| STATUE-08 | B | `When the torch is dark, follow the silver statue.` | 火把會熄滅，銀雕像唯一 | 等火把熄滅，再選銀雕像 |
| STATUE-09 | B | `Touch the moon. Then follow the blue statue.` | 月亮符文與藍雕像唯一 | 先點月亮，再走藍雕像的橋 |
| STATUE-10 | C | `Do not follow the small statue.` | 小雕像指錯橋，另外兩座都指安全橋 | 選任一非小雕像並走安全橋 |
| STATUE-11 | C | `The red statue points to danger. Follow the king.` | 紅雕像與國王雕像不同 | 忽略紅雕像，走國王指的橋 |
| STATUE-12 | C | `Touch the shield first. Then follow the statue with a torch.` | 盾符文與持火把雕像唯一 | 先點盾符文，再走持火把雕像的橋 |

### 主題換皮

| 城堡 | 幽靈船 | 星艦 |
|---|---|---|
| 國王、騎士與怪獸雕像 | 船首像、船長木像與海怪像 | 指路機器人與外星石像 |
| 劍、盾、火把 | 彎刀、船盾、船燈 | 工具、力場板、訊號燈 |
| 石橋 | 木板橋 | 維修通道 |

---

## 8. 每場抽取規則

1. 一場從六種模板抽四種，不重複模板。
2. 第 1 層只從 A 級規則抽取。
3. 第 2 層以 A、B 級為主。
4. 第 3 層抽 B 級，可有一個短兩步規則。
5. 第 4 層抽 B、C 級，但不能同時包含兩個否定條件和兩個資訊來源。
6. 如果本場前面已出現 `first / then`，下一關優先使用位置、顏色或時間規則，避免句型重複。
7. 同一個規則 ID 在最近三場內不重複，除非可用規則不足。
8. 規則卡打開時生成並鎖定關卡，不在重試時換成另一句英文。

---

## 9. 第一輪兒童測試要觀察的事情

- 孩子是否先讀完整句子才按 **I AM READY**。
- 哪些字需要成人解釋：beside, both, quiet, holding, lantern 等。
- `do not` 是否容易被漏讀。
- 兩句規則是否讓孩子忘記第一步。
- 規則理解正確時，操作本身是否仍造成不必要失敗。
- 同一場改變規則後，孩子是否真的改變行動。
- **FLOOR IS LAVA!** 的語音是否提高興奮感，而不是讓孩子慌張到忘記規則。
- 哪四種模板最有趣，適合進入第一個完整版本。

測試後應先刪除或重寫容易誤解的規則，而不是用更多提示補救不清楚的英文。
