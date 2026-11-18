CastleScenes.basement = function (rooms) {
  var cryptOutline = [[27, 373], [728, 18], [1510, 425], [1510, 629], [825, 984], [27, 590]];
  var cryptFloorCorners = [[743, 318], [1510, 620], [825, 970], [27, 579]];
  var cryptOpening = "M 273 454 L 273 373 C 273 350 275 339 279 327 C 288 302 304 282 322 271 C 335 263 348 260 356 269 C 362 276 362 287 362 300 L 362 408 L 362 411 Q 317 430 273 454 Z";
  rooms.cellar = {
    name: "地下樓梯廳",
    hint: "Take the stairs to go upstairs.",
    bounds: { left: 7, right: 30, top: 7, bottom: 27 },
    spawn: { x: 10.5, y: 18.5, facing: 7 },
    art: { asset: "cryptLanding", outline: cryptOutline, floorCorners: cryptFloorCorners, stairJambs: [256, 385] },
    exit: {
      type: "stairs", label: "上樓回一樓", next: "hall", duration: 1.35,
      approach: { x: 7.5, y: 18.5 },
      destination: { x: 6.45, y: 18.5, z: 78 },
      arrival: { x: 14.5, y: 16.5, facing: 6 }
    }
  };
  rooms.vault = {
    name: "地下石廳",
    hint: "Tap the chest to open it.",
    bounds: { left: 30, right: 53, top: 7, bottom: 27 },
    art: {
      asset: "cryptCrossing", outline: cryptOutline, floorCorners: cryptFloorCorners, opening: cryptOpening,
      otherOpening: "M 1128 456 L 1128 348 C 1128 328 1119 327 1120 316 C 1122 301 1134 293 1150 294 C 1177 296 1207 338 1213 373 L 1213 492 Q 1165 470 1128 456 Z"
    },
    treasure: { x: 39.5, y: 17.5, name: "琥珀碎片", color: "#ffbf68" }
  };
  rooms.ossuary = {
    name: "石匣室",
    hint: "Go through the arch to head back.",
    bounds: { left: 31, right: 51, top: 27, bottom: 50 },
    art: { asset: "cryptOssuary", outline: cryptOutline, floorCorners: cryptFloorCorners, opening: cryptOpening, mirror: true }
  };
  rooms.archive = {
    name: "地下檔案室",
    hint: "Go through the arch to head back.",
    bounds: { left: 31, right: 51, top: -16, bottom: 7 },
    art: { asset: "cryptArchive", outline: cryptOutline, floorCorners: [[740, 345], [1510, 620], [825, 970], [27, 579]], mirror: true }
  };
  rooms.treasury = {
    name: "藏寶室",
    hint: "Open the chest and tap the treasure.",
    bounds: { left: 53, right: 76, top: 7, bottom: 27 },
    art: { asset: "cryptTreasury", outline: cryptOutline, floorCorners: cryptFloorCorners, opening: cryptOpening },
    treasure: { x: 61.5, y: 18.5, name: "月光石", color: "#96d8ff" }
  };
  rooms.corridor = {
    name: "地下試煉長廊",
    hint: "Tap a door to choose a trial.",
    bounds: { left: 7, right: 19, top: 27, bottom: 63 },
    spawn: { x: 9.5, y: 30.5, facing: 3 },
    art: { asset: "cryptCrossing", leftWallAsset: "cryptArchive", outline: cryptOutline, floorCorners: cryptFloorCorners,
      otherOpening: rooms.vault.art.otherOpening }
  };
  return {
    roofOffsets: {"cryptLanding": [7, 6, 6, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 0, 0, 1, -1, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, 1, 1, 1, 2, 2, 2, 3, 2, 5, 5, 5, 6, 5, 5, 4, 5, 5, 5, 5, 5, 5, 4, 4, 3, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 3, 5, 4, 4, 4, 6, 6, 7, 7, 8], "cryptCrossing": [8, 7, 8, 7, 6, 6, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 2, 2, 3, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 2, 3, 3, 4, 4, 3, 4, 4, 6, 7, 7, 8, 7, 7, 7, 7, 8, 7, 7, 7, 7, 6, 6, 6, 7, 6, 6, 6, 7, 7, 7, 7, 7, 7, 6, 6, 5, 7, 7, 5, 5, 6, 6, 5, 6, 7, 8, 8, 8, 9], "cryptArchive": [8, 8, 8, 7, 6, 6, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 2, 2, 2, 2, 3, 4, 4, 4, 4, 4, 6, 6, 6, 7, 6, 6, 6, 7, 7, 6, 6, 7, 6, 6, 5, 5, 5, 5, 5, 5, 6, 6, 5, 5, 5, 5, 4, 5, 4, 5, 5, 4, 4, 5, 5, 5, 5, 7, 8, 8, 8, 9], "cryptTreasury": [8, 8, 8, 7, 6, 6, 7, 6, 5, 5, 5, 4, 4, 4, 4, 3, 2, 2, 3, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 2, 3, 4, 4, 4, 4, 4, 6, 6, 6, 8, 7, 7, 7, 8, 8, 7, 7, 7, 7, 7, 6, 6, 7, 6, 6, 6, 7, 7, 7, 6, 7, 7, 6, 6, 5, 7, 7, 6, 6, 7, 7, 6, 7, 8, 9, 9, 9, 10], "cryptOssuary": [8, 7, 7, 7, 5, 5, 6, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2, 3, 2, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 2, 3, 3, 3, 4, 4, 4, 4, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 5, 5, 7, 7, 6, 6, 7, 7, 6, 5, 5, 6, 6, 5, 5, 6, 5, 5, 6, 8, 8, 8, 8, 9]},
    rooms: [rooms.archive, rooms.cellar, rooms.vault, rooms.ossuary, rooms.treasury, rooms.corridor],
    links: [
      { axis: "y", at: 27, jambs: [1128, 1213], sill: [465, 501], before: rooms.cellar, after: rooms.corridor },
      { axis: "x", at: 30, jambs: [273, 362], sill: [463, 420], before: rooms.cellar, after: rooms.vault },
      { axis: "x", at: 53, jambs: [273, 362], sill: [463, 420], before: rooms.vault, after: rooms.treasury },
      { axis: "y", at: 7, jambs: [1128, 1213], sill: [465, 501], before: rooms.archive, after: rooms.vault },
      { axis: "y", at: 27, jambs: [273, 362], sill: [463, 420], before: rooms.vault, after: rooms.ossuary }
    ],
    bounds: { left: 7, right: 76, top: -16, bottom: 63 }
  };
};
