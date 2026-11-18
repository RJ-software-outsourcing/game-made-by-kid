CastleScenes.lava = {
  hint: "Tap a stone to move.",
  assets: ["trialFigures", "trialBrick", "gatePassage", "emberSconce", "radiantStone", "furnaceWall", "guardianRelief", "bannerLinen"],
  entrance: {start:-13, end:1, spawn:{x:-3.5,y:2.5}, scroll:{x:-.5,y:2.5}},
  fixedSeconds: 60,
  bannerLead: 3,
  warningStart: 4,
  eruptionStart: 7,
  eruptionEnd: 14,
  coolingDuration: 2.5,
  landingLength: 6,
  rules: [
    { label: "Blue stone", text: "When the floor glows red, find a blue stone and stand on it.", tiles: ["bm","rs","gd","am","rd"], safe: tile => tile[0] === "b" },
    { label: "Moon signs", text: "When the floor glows red, find a moon and stand on it.", tiles: ["am","bs","rd","gs","ad"], safe: tile => tile[1] === "m" },
    { label: "Green stars", text: "When the floor glows red, find a green star and stand on it.", tiles: ["gs","gm","rs","bd","am"], safe: tile => tile === "gs" },
    { label: "Moon without red", text: "When the floor glows red, find a moon and stand on it. Red moons burn.", tiles: ["bm","rm","bs","gd","as"], safe: tile => tile[1] === "m" && tile[0] !== "r" },
    { label: "Castle banners", banners:true, text: "When the banners drop, find a stone with the same mark and stand on it.", tiles:["bm","gs","rd"], safe: (tile,mark) => tile === mark }
  ],
  createBoard(length,rule) {
    if (rule?.banners) {
      const board=Array.from({length},()=>Array(5).fill(-1));
      // A stable board: each pair of rows offers all three marks within the warning window.
      for (let row=1;row<length;row+=2) {
        const lanes=[0,1,2,3,4];
        rule.tiles.forEach((_,slot)=>{
          const [lane]=lanes.splice(Math.floor(Math.random()*lanes.length),1);
          board[row][lane]=slot;
        });
      }
      return board;
    }
    // Entries are indices into the selected rule. Zero is the matching stone.
    const board = Array.from({length}, () => Array.from({length:5}, () =>
      Math.random() < .55 ? -1 : 1 + Math.floor(Math.random()*4)));
    let lane = Math.floor(Math.random()*5);
    for (let row=2; row<length; row+=2+Math.floor(Math.random()*2)) {
      lane = (lane + 1 + Math.floor(Math.random()*4)) % 5;
      board[row][lane] = 0;
    }
    return board;
  }
};
