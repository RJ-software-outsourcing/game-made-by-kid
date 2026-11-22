CastleScenes["trial-view"] = function (game, art, helpers) {
  const {paintPhotoTriangle, currentCojiFrames, cojiFrameForFacing, drawFrame, drawFootContact} = helpers;
  const { canvas, ctx, player } = game;
  const slab = art.sprite("trialSlab");
  const figures = art.sprite("trialFigures"), shrine = art.sprite("trialShrine");
  const offeringArt = {key:"offeringKey", crystal:"offeringCrystal"};
  const passage = art.sprite("gatePassage");
  const basalt = art.sprite("stone");
  const brick = art.sprite("trialBrick"), sconce = art.sprite("emberSconce");
  const mineral = {b:"#216db1",r:"#a74a3e",g:"#35836a",a:"#b5894a"};
  const slabs = new Map(), rows = new Map(), portraits = new Map();
  const size = 112;
  let lanes = 5;
  const lecternBase = .915, gateSetback=.35;
  let hits = [];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let lastBoard, entryView, watchingEye=false;
  function camera() {
    const w = canvas._w, h = canvas._h;
    const c = {w, h, horizon:h*.08, feet:h*.63, unit:Math.min(w*.15,h*.185), focal:6.2,
      center:lanes/2 + (player.y - lanes/2)*.4};
    if(watchingEye){c.feet=h*.89;c.horizon=h*.51;}
    if (entryView?.rule.banners) {
      // A longer lens on narrow screens keeps the two distant signals legible.
      c.unit=Math.min(c.unit,w*.138);
      c.focal=Math.max(8,Math.min(17,1050/c.unit));
      const bannerHorizon=Math.min(h*.31,112);
      const rise=Math.max(0,bannerHorizon-c.horizon)*entryView.light;
      c.horizon+=rise;
      c.feet+=rise*.62;
      // Frame the raised insignia even from the last dangerous row, with a fixed lens for the crossing.
      const k=c.focal/(c.focal+entryView.landingEnd-gateSetback-entryView.board.length);
      const linen=art.sprite("bannerLinen");
      const markHeight=(floorY-railY-clothWidth*linen.height/linen.width*markPosition)/wallPixelsPerTile;
      const lastMarkY=c.horizon+(c.feet-c.horizon-markHeight*c.unit)*k;
      const lift=Math.max(0,Math.min(h*.16,h*.15-lastMarkY))*entryView.light;
      c.horizon+=lift;c.feet+=lift;
    }
    if (entryView) {
      // Set the pitch from the entrance sightline once, so it stays steady as Coji walks.
      const k=c.focal/(c.focal+entryView.landingEnd-gateSetback-entryView.entrance.spawn.x);
      const summit=c.horizon+(c.feet-c.horizon-muralTop*c.unit)*k;
      c.horizon+=Math.max(0,h*.035-summit)/(1-k)*entryView.light;
    }
    if (entryView && entryView.light<1) {
      const desk=project(c,entryView.entrance.scroll.x,entryView.entrance.scroll.y);
      const height=Math.min(h*.34,w*.42)*desk.k*.56;
      const shift=(h*.5-desk.y+height*(lecternBase-.5))*(1-entryView.light);
      c.horizon+=shift;c.feet+=shift;
    }
    return c;
  }
  function project(c, x, y) {
    const k = c.focal / (c.focal + x - player.x);
    return {x:c.w*.5 + (y-c.center)*c.unit*k, y:c.horizon + (c.feet-c.horizon)*k, k};
  }
  function depthAtScale(c,k) {
    return player.x+c.focal*(1/k-1);
  }
  function ground(p) {
    const c = camera(), k = (p.y-c.horizon)/(c.feet-c.horizon);
    if (k <= .025) return null;
    return {x:depthAtScale(c,k), y:c.center + (p.x-c.w*.5)/(c.unit*k)};
  }
  function surface(w,h) {
    const el = document.createElement("canvas");
    el.width = w; el.height = h;
    return el;
  }
  function symbol(g, code) {
    g.beginPath();
    if (code === "m") {
      g.moveTo(13,-26); g.bezierCurveTo(-32,-29,-38,21,-1,26);
      g.bezierCurveTo(11,28,23,22,27,14); g.bezierCurveTo(-5,24,-15,-8,13,-26);
    } else if (code === "s") {
      for (let i=0;i<10;i++) {
        const a = i*Math.PI/5-Math.PI/2, r = i%2 ? 12 : 29;
        if (i) g.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        else g.moveTo(Math.cos(a)*r,Math.sin(a)*r);
      }
    } else { g.moveTo(0,-26); g.lineTo(20,0); g.lineTo(0,26); g.lineTo(-20,0); }
    g.closePath();
    const gold = g.createLinearGradient(-22,-25,24,24);
    gold.addColorStop(0,"#ffe7a4"); gold.addColorStop(.4,"#b9955c");
    gold.addColorStop(.55,"#f2d69b"); gold.addColorStop(1,"#997849");
    g.fillStyle = gold; g.lineWidth = 3;
    g.strokeStyle = "#372e21"; g.stroke(); g.fill();
    if (slab.naturalWidth) {
      g.save(); g.clip(); g.globalCompositeOperation="soft-light"; g.globalAlpha=.7;
      g.drawImage(slab,-size/2,-size/2,size,size); g.restore();
    }
  }
  function stone(code) {
    if (slabs.has(code)) return slabs.get(code);
    const el = surface(size,size), g = el.getContext("2d");
    g.fillStyle = "#696465"; g.fillRect(0,0,size,size);
    if (slab.naturalWidth) g.drawImage(slab,0,0,size,size);
    if (code !== "--") {
      g.fillStyle = mineral[code[0]]; g.globalCompositeOperation = "color"; g.fillRect(3,3,size-6,size-6);
      g.globalCompositeOperation = "multiply"; g.globalAlpha = .58; g.fillRect(3,3,size-6,size-6);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      g.translate(size/2,size/2); symbol(g,code[1]);
    }
    slabs.set(code,el); return el;
  }
  let entryFloor;
  function vestibule(entry) {
    if (entryFloor) return entryFloor;
    const w=lanes*size,h=(entry.end-entry.start)*size;
    entryFloor=surface(w,h);
    const g=entryFloor.getContext("2d");
    for (let y=0;y<h;y+=size*2) for (let x=0;x<w;x+=size*2)
      g.drawImage(stone("--"),x,y,size*2,size*2);
    g.fillStyle="#213c4470";g.fillRect(0,0,w,h);
    for (const inset of [5,12]) {
      g.strokeStyle=inset===5?"#453c2c":"#b8a077";g.lineWidth=inset===5?8:2;
      g.strokeRect(inset,inset,w-inset*2,h-inset*2);
    }
    return entryFloor;
  }
  let landingSurface;
  function landingPaving(rows) {
    if (landingSurface) return landingSurface;
    const width=lanes*size, height=rows*size;
    landingSurface=surface(width,height);
    const g=landingSurface.getContext("2d");
    for (let y=0;y<height;y+=size) for (let x=0;x<width;x+=size)
      g.drawImage(stone("--"),x,y);
    g.globalAlpha=.78;
    const band=2.3*size, repeat=4*size;
    for (let row=0;row*band<height;row++) {
      for (let x=-(row%2)*repeat/2;x<width;x+=repeat)
        g.drawImage(brick,0,brick.height*.085,brick.width,brick.height*.83,x,row*band,repeat+.5,band+.5);
    }
    g.globalAlpha=1;
    // Contact shadows along the two parapets and where the bridge meets the door sill.
    const edges=g.createLinearGradient(0,0,width,0);
    edges.addColorStop(0,"#17120dac");edges.addColorStop(.08,"transparent");
    edges.addColorStop(.92,"transparent");edges.addColorStop(1,"#17120dac");
    g.fillStyle=edges;g.fillRect(0,0,width,height);
    const sill=gateSetback*size, shade=g.createLinearGradient(0,sill,0,sill+size*.65);
    shade.addColorStop(0,"#18130d9e");shade.addColorStop(1,"transparent");
    g.fillStyle=shade;g.fillRect(0,sill,width,size*.65);
    return landingSurface;
  }
  const floorLayer = surface(1,1);
  const islands = new Map();
  const period = 384;
  let heatedFloor;
  function radiantFloor() {
    if (heatedFloor) return heatedFloor;
    const stone=art.sprite("radiantStone");
    heatedFloor=surface(period*3,period*3);
    const g=heatedFloor.getContext("2d");
    for (let j=0;j<3;j++) for (let i=0;i<3;i++)
      g.drawImage(stone,i*period,j*period,period,period);
    // Bloom the bright pockets in this same material throughout the cycle.
    const light=surface(heatedFloor.width,heatedFloor.height), b=light.getContext("2d");
    b.filter="contrast(1.8) blur(10px)";b.drawImage(heatedFloor,0,0);
    g.globalCompositeOperation="screen";g.globalAlpha=.16;g.drawImage(light,0,0);
    return heatedFloor;
  }
  function rockIsland(code,variant) {
    const key = code+variant;
    if (islands.has(key)) return islands.get(key);
    const el = surface(size,size), g = el.getContext("2d");
    const edge = new Path2D();
    const corners = [[7,17],[27,6],[58,4],[90,9],[105,24],[108,57],[100,88],[85,99],[56,104],[22,99],[6,83],[3,46]];
    corners.forEach(([x,y],i) => {
      const dx = Math.sin(variant+i*7)*3, dy = Math.cos(variant*2+i)*3;
      if (i) edge.lineTo(x+dx,y+dy); else edge.moveTo(x+dx,y+dy);
    });
    edge.closePath();
    g.save();g.translate(0,4);
    g.shadowColor="#ffbb37";g.shadowBlur=7;g.strokeStyle="#ff9a28";g.lineWidth=4;g.stroke(edge);
    g.fillStyle="#562614";g.fill(edge);g.restore();
    g.save();g.clip(edge);
    const rock=basalt.naturalWidth ? basalt : slab;
    const extent=rock.width*.49;
    g.drawImage(rock,variant*rock.width*.18,rock.height*.16,extent,extent,0,0,size,size);
    g.fillStyle="#aca199";g.globalCompositeOperation="multiply";g.fillRect(0,0,size,size);
    g.globalCompositeOperation="source-over";
    const rim=g.createRadialGradient(53,47,27,54,52,59);
    rim.addColorStop(0,"#ff7a0800");rim.addColorStop(.77,"#fb752212");rim.addColorStop(1,"#ffa239c0");
    g.fillStyle=rim;g.fillRect(0,0,size,size);
    g.strokeStyle="#a56b48";g.lineWidth=3;g.stroke(edge);
    g.translate(size/2,size/2);g.scale(.60,.60);g.globalAlpha=.76;symbol(g,code[1]);
    g.restore();islands.set(key,el);return el;
  }
  function rowImage(codes,mode,variant,s) {
    const key=mode+(mode==="hot"?variant+(s.bannerTile||""):"")+codes.join("");
    if (rows.has(key)) return rows.get(key);
    const el=surface(lanes*size,size),g=el.getContext("2d");
    codes.forEach((code,i) => {
      if (mode==="stone") g.drawImage(stone(code),i*size,0);
      else if (s.rule.safe(code,s.bannerTile)) g.drawImage(rockIsland(code,variant),i*size,0);
    });
    rows.set(key,el);return el;
  }
  function drawFloor(c,s,tileAt,finish,end) {
    const bottomScale=(c.h-c.horizon)/(c.feet-c.horizon);
    const near=Math.max(s.entrance?.start ?? -4,Math.floor(depthAtScale(c,bottomScale)));
    const w=Math.ceil(c.w),h=Math.ceil(c.h);
    if (floorLayer.width!==w || floorLayer.height!==h) {floorLayer.width=w;floorLayer.height=h;}
    const g=floorLayer.getContext("2d");
    g.clearRect(0,0,w,h);
    const t=game.time(), flow=t*.23, span=c.feet-c.horizon;
    for (let row=end;row>=near;row--) {
      const farEdge=(s.id==="lava" || s.journey) && row===end ? row+1-gateSetback : row+1;
      const top=project(c,farEdge,0),bottom=project(c,row,0);
      const y0=Math.max(0,Math.ceil(top.y-.5)),y1=Math.min(h,Math.ceil(bottom.y-.5));
      if (y1<=y0) continue;
      const inCourse=s.id==="lava" && row>=s.entrance.end && row<finish;
      const onPorch=s.entrance && row<s.entrance.end;
      const codes=Array.from({length:lanes},(_,i)=>inCourse ? tileAt(row,i) : "--");
      let strip, stripY=0;
      if (onPorch) {
        strip=vestibule(s.entrance);stripY=(s.entrance.end-1-row)*size;
      } else if (s.id==="lava" && row>=finish) {
        strip=landingPaving(end+1-finish);stripY=(end-row)*size;
      } else strip=rowImage(codes,"stone",0,s);
      const warning=s.phase==="warning";
      const warningGlow=s.rule.banners ? s.heat**1.7 : 1-(1-s.heat)**1.6;
      const coverage=inCourse ? (warning ? warningGlow : s.melt) : 0;
      const current=coverage>0 ? radiantFloor() : null;
      // The rock silhouette emerges through the last of the glow before movement locks.
      const rockOpacity=warning ? Math.max(0,(s.heat-.91)/.09) : 1;
      const islands=current && rockOpacity>0 && codes.some(code=>s.rule.safe(code,s.bannerTile)) ? rowImage(codes,"hot",row%3,s) : null;
      const stoneOpacity=1-coverage;
      for (let y=y0;y<y1;y++) {
        const k=(y+.5-c.horizon)/span,z=depthAtScale(c,k);
        const x=c.w*.5-c.center*c.unit*k,width=lanes*c.unit*k;
        const dz=c.focal/(span*k*k), v=Math.min(size-1,Math.max(0,(row+1-z)*size));
        const band=Math.min(size-v,Math.max(1,dz*size));
        if (current) {
          const u=period+(flow*9 % period)+Math.sin(z*.68+flow)*12+Math.sin(z*1.7-flow*.6)*4;
          const vz=-z*62+flow*15+Math.sin(z*.4-flow)*5;
          const sourceY=period+(vz%period+period)%period;
          g.drawImage(current,u,sourceY,lanes*67,Math.min(32,Math.max(1,dz*62)),x,y,width,1);
          if (islands) {
            g.globalAlpha=rockOpacity;g.drawImage(islands,0,v,islands.width,band,x,y,width,1);g.globalAlpha=1;
          }
        }
        if (stoneOpacity>0) {
          g.globalAlpha=stoneOpacity;
          g.drawImage(strip,0,stripY+v,strip.width,band,x,y,width,1);
          g.globalAlpha=1;
        }
      }
    }
    ctx.drawImage(floorLayer,0,0);
  }
  // Facade coordinates are texture pixels at a fixed world scale. Both wings share
  // the central relief's vertical plane, including their rails and moving cloth.
  const wallPixelsPerTile=112, reliefWidth=5*wallPixelsPerTile;
  const wingWidth=3.4*wallPixelsPerTile, outerPier=wallPixelsPerTile;
  const facadeWidth=2*(outerPier+wingWidth)+reliefWidth;
  const courseHeight=2.75*wallPixelsPerTile, floorY=9*courseHeight, railY=floorY-3*courseHeight;
  const clothWidth=wingWidth*.84, markPosition=.54;
  const gateHeight=2.56, gateAspect=.63, gateBase=.97;
  const muralTop=15.8, muralBottom=1.4;
  const edgeShadowWidth=Math.round(.55*wallPixelsPerTile);
  let eclipseLight;
  function carveGuardians(g,wallWidth) {
    const relief=art.sprite("guardianRelief");
    const w=12.6*wallPixelsPerTile, h=(muralTop-muralBottom)*wallPixelsPerTile;
    const top=floorY-muralTop*wallPixelsPerTile, left=(wallWidth-w)/2;
    // The texture contains the tapered silhouette and irregular, feathered stone edges.
    g.save();g.globalAlpha=.88;g.drawImage(relief,left,top,w,h);
    g.globalCompositeOperation="soft-light";g.globalAlpha=.36;g.drawImage(relief,left,top,w,h);g.restore();

    // Sample the eclipse itself so reflected light follows its chiseled rays.
    const glowSize=192, glow=surface(glowSize,glowSize), light=glow.getContext("2d");
    const radius=w*.22, cx=w*.5, cy=h*.29;
    light.filter="grayscale(1) contrast(1.8) sepia(1) saturate(3.2)";
    light.drawImage(relief,(cx-radius)*relief.width/w,(cy-radius)*relief.height/h,
      2*radius*relief.width/w,2*radius*relief.height/h,0,0,glowSize,glowSize);
    light.filter="none";light.globalCompositeOperation="destination-in";
    const ring=light.createRadialGradient(96,96,0,96,96,96);
    ring.addColorStop(0,"transparent");ring.addColorStop(.49,"transparent");
    ring.addColorStop(.70,"black");ring.addColorStop(1,"transparent");
    light.fillStyle=ring;light.fillRect(0,0,glowSize,glowSize);
    eclipseLight={image:glow,x:left+cx-radius,y:top+cy-radius,size:radius*2};
  }
  let wallPanel,cellarBrickPattern;
  function cellarBrickwork(g,x,y,width,height) {
    if (!cellarBrickPattern) {
      const repeat=4*wallPixelsPerTile, crop=brick.height*.83;
      const band=Math.round(repeat*crop/brick.width);
      const tile=surface(repeat,2*band),t=tile.getContext("2d");
      for (const [left,top] of [[0,0],[-repeat/2,band],[repeat/2,band]])
        t.drawImage(brick,0,brick.height*.085,brick.width,crop,left,top,repeat,band);
      cellarBrickPattern=g.createPattern(tile,"repeat");
    }
    g.save();g.translate(0,floorY);g.fillStyle=cellarBrickPattern;
    g.fillRect(x,y-floorY,width,height);g.restore();
  }
  function cellarMasonry() {
    if (wallPanel) return wallPanel;
    const relief=art.sprite("furnaceWall");
    const panel=surface(Math.round(facadeWidth+2*edgeShadowWidth),floorY), g=panel.getContext("2d");
    const left=edgeShadowWidth, right=panel.width-edgeShadowWidth;
    g.save();g.beginPath();g.rect(left,0,right-left,panel.height);g.clip();
    // Carry the bridge masonry through the facade at the same four-tile repeat.
    const repeat=4*wallPixelsPerTile, band=2.3*wallPixelsPerTile;
    g.fillStyle="#343029";g.fillRect(0,0,panel.width,floorY);
    g.save();g.beginPath();g.rect(0,0,panel.width,floorY);g.clip();
    cellarBrickwork(g,left,0,right-left,floorY);
    // The highest cornice carries both rods. Continue the parapet caps into the abutment.
    for (const seam of [railY,floorY-2.3*wallPixelsPerTile]) {
      for (let x=0;x<panel.width;x+=repeat)
        g.drawImage(brick,0,0,brick.width,brick.height*.095,x,seam-3,repeat,band*.095);
    }
    g.restore();
    const h=Math.round(reliefWidth*relief.height/relief.width);
    const carving=surface(reliefWidth,h), cg=carving.getContext("2d");
    cg.drawImage(relief,0,0,reliefWidth,h);
    // Feather the dressed stone into the surrounding courses on three sides.
    cg.globalCompositeOperation="destination-in";
    const sides=cg.createLinearGradient(0,0,reliefWidth,0);
    sides.addColorStop(0,"transparent");sides.addColorStop(.12,"black");
    sides.addColorStop(.88,"black");sides.addColorStop(1,"transparent");
    cg.fillStyle=sides;cg.fillRect(0,0,reliefWidth,h);
    const crown=cg.createLinearGradient(0,0,0,h*.25);
    crown.addColorStop(0,"transparent");crown.addColorStop(1,"black");
    cg.fillStyle=crown;cg.fillRect(0,0,reliefWidth,h);
    carveGuardians(g,panel.width);
    g.drawImage(carving,(panel.width-reliefWidth)/2,floorY-h);
    g.fillStyle="rgba(19,16,15,.20)";g.fillRect(0,0,panel.width,floorY);
    // Seat the door surround in the masonry and leave its animated opening registered to it.
    const doorH=gateHeight*wallPixelsPerTile, doorW=doorH*gateAspect;
    g.save();g.shadowColor="#18130f";g.shadowBlur=7;g.shadowOffsetY=2;
    g.drawImage(art.arch,(panel.width-doorW)/2,floorY-doorH*gateBase,doorW,doorH);
    g.restore();
    g.restore();
    // Both gradients run outwards from the last opaque stone into the transparent gutters.
    for (const [edge,outer] of [[left,0],[right,panel.width]]) {
      const shadow=g.createLinearGradient(edge,0,outer,0);
      shadow.addColorStop(0,"rgba(0,0,0,.32)");shadow.addColorStop(.42,"rgba(0,0,0,.12)");
      shadow.addColorStop(1,"transparent");
      g.fillStyle=shadow;g.fillRect(Math.min(edge,outer),0,edgeShadowWidth,panel.height);
    }
    wallPanel=panel;
    return wallPanel;
  }
  function drawCellarWall(c,depth,s) {
    const foot=project(c,depth,lanes/2), scale=c.unit*foot.k/wallPixelsPerTile;
    const panel=cellarMasonry();
    ctx.save();
    ctx.translate(foot.x,foot.y);ctx.scale(scale,scale);
    ctx.translate(-panel.width/2,-floorY);
    // Continue the masonry below the bridge at its original repeat size.
    const foundation=Math.max(0,(c.h-foot.y)/scale);
    cellarBrickwork(ctx,edgeShadowWidth,floorY,facadeWidth,foundation);
    ctx.fillStyle="rgba(19,16,15,.20)";ctx.fillRect(edgeShadowWidth,floorY,facadeWidth,foundation);
    ctx.drawImage(panel,0,0);
    if (s.furnace>0 && game.effects()) {
      ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=s.furnace*.62;
      ctx.drawImage(eclipseLight.image,eclipseLight.x,eclipseLight.y,eclipseLight.size,eclipseLight.size);
      ctx.restore();
    }
    ctx.translate((panel.width-facadeWidth)/2,0);
    if (s.rule.banners) drawWallStandards(s);
    ctx.restore();
  }
  function floorLightOnWalls(c,s,finish) {
    if (!s.heat) return;
    const start=Math.max(s.entrance.end,player.x-3.4);
    if (start>=finish) return;
    ctx.save();ctx.globalCompositeOperation="screen";
    for (const lane of [0,lanes]) {
      const a=project(c,start,lane),b=project(c,finish,lane);
      // Nested translucent strips feather the reflected pool of light up the vertical stone.
      const steps=12, height=c.unit*(.64+.54*s.heat);
      for (let i=0;i<steps;i++) {
        const lo=height*i/steps, hi=height*(i+1)/steps;
        ctx.beginPath();ctx.moveTo(a.x,a.y-a.k*lo);ctx.lineTo(b.x,b.y-b.k*lo);
        ctx.lineTo(b.x,b.y-b.k*hi);ctx.lineTo(a.x,a.y-a.k*hi);ctx.closePath();
        ctx.fillStyle="rgba(255,108,30,"+(.40*s.heat*(1-i/steps)**2)+")";ctx.fill();
      }
    }
    ctx.restore();
  }
  // Both walls follow the same world-space projection as the walkable tiles.
  function drawArcade(c, end, s) {
    const wall = s.id === "lava" || s.journey ? brick : shrine;
    if (!wall.naturalWidth) return;
    const bay = 4, near = Math.max(s.entrance?.start ?? -4,player.x - (s.entrance ? c.focal-.45 : 3.4));
    for (let row=Math.ceil(end/bay)*bay;row+bay>near;row-=bay) {
      const start = Math.max(near,row), stop = Math.min(end+.65,row+bay);
      if (stop<=start) continue;
      for (const lane of [0,lanes]) {
        const nearFoot=project(c,start,lane), farFoot=project(c,stop,lane);
        if ((nearFoot.x<0 && farFoot.x<0) || (nearFoot.x>c.w && farFoot.x>c.w)) continue;
        const height=c.unit*2.3;
        const top = p => ({x:p.x, y:p.y-p.k*height});
        const step=.5;
        ctx.save();
        // Keep texture vertices on fixed world positions as the near clip moves.
        for (let j=Math.floor(start/step)*step;j<stop;j+=step) {
          const a=Math.max(j,start),b=Math.min(j+step,stop);
          const p=project(c,a,lane),q=project(c,b,lane);
          if ((p.x<0 && q.x<0) || (p.x>c.w && q.x>c.w)) continue;
          const u=(a-row)/bay*wall.width,v=(b-row)/bay*wall.width;
          const l={x:u,y:0},r={x:v,y:0},m={x:v,y:wall.height},n={x:u,y:wall.height};
          paintPhotoTriangle(ctx,wall,{photo:[l,r,m],world:[top(p),top(q),q]});
          paintPhotoTriangle(ctx,wall,{photo:[l,m,n],world:[top(p),q,p]});
        }
        const rim = lane === 0 ? -.2 : lanes+.2;
        const a = top(nearFoot), b = top(farFoot);
        const d = top(project(c,start,rim)), e = top(project(c,stop,rim));
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(e.x,e.y); ctx.lineTo(d.x,d.y); ctx.closePath();
        ctx.fillStyle = "#655946"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#8a7759"; ctx.stroke();
        ctx.restore();
      }
    }
  }
  function halo(x,y,r,color) {
    const grad = ctx.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,color); grad.addColorStop(1,"transparent");
    ctx.fillStyle = grad; ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function shadow(x,y,r) {
    ctx.save(); ctx.translate(x,y); ctx.scale(1,.22); halo(0,0,r,"#08070be0"); ctx.restore();
  }
  // Advected noise cuts wisps out of the flame silhouette. Share the small frames between braziers.
  const flameFrames = [];
  const noiseGrid = Array.from({length:256},(_,i) => {
    const n=Math.sin(i*78.233+9.12)*43758.5453; return n-Math.floor(n);
  });
  function noise(x,y) {
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
    const a=fx*fx*(3-2*fx), b=fy*fy*(3-2*fy);
    const at=(dx,dy)=>noiseGrid[(((iy+dy)&15)<<4)|((ix+dx)&15)];
    return (at(0,0)*(1-a)+at(1,0)*a)*(1-b)+(at(0,1)*(1-a)+at(1,1)*a)*b;
  }
  function flameFrame(index) {
    if (flameFrames[index]) return flameFrames[index];
    const el=surface(64,108),g=el.getContext("2d"),image=g.createImageData(el.width,el.height);
    const t=index/32, angle=t*Math.PI*2;
    for(let y=0;y<el.height;y++) {
      const v=(el.height-y-.5)/el.height, taper=Math.pow(1-v,.63);
      const bend=(.20*Math.sin(v*6-angle)+.10*Math.sin(v*13+angle))*v;
      for(let x=0;x<el.width;x++) {
        const u=(x+.5)/el.width*2-1;
        const eddy=noise(u*2.1+5,v*4.6-t*16)*.68+noise(u*6+11,v*9.2-t*16)*.32;
        const core=1-Math.abs(u-bend)/(.73*taper+.03);
        const energy=core*.68+(eddy-.4)*(.75+1.08*v)-v*.19;
        const coverage=Math.min(1,Math.max(0,energy*5))*Math.min(1,(1-v)*9)*Math.min(1,v*24);
        const heat=Math.min(1,Math.max(0,(energy+.13)*(1.23-.32*v)));
        const off=(y*el.width+x)*4;
        image.data[off]=255;image.data[off+1]=48+194*heat;
        image.data[off+2]=8+160*heat**3;image.data[off+3]=coverage*(125+120*heat);
      }
    }
    g.putImageData(image,0,0);flameFrames[index]=el;return el;
  }
  const standards=new Map();
  function standardCloth(mark) {
    if (standards.has(mark)) return standards.get(mark);
    const linen=art.sprite("bannerLinen");
    const el=surface(linen.width,linen.height),g=el.getContext("2d");
    g.drawImage(linen,0,0);
    g.globalCompositeOperation="multiply";g.fillStyle=mineral[mark[0]];g.fillRect(0,0,el.width,el.height);
    g.globalCompositeOperation="destination-in";g.drawImage(linen,0,0);
    g.globalCompositeOperation="source-over";
    g.save();g.translate(el.width*.5,el.height*markPosition);
    const scale=el.width*.50/56;
    g.scale(scale,scale);symbol(g,mark[1]);g.restore();
    // Preserve the same weave and fold shadows across the embroidered mark.
    g.globalCompositeOperation="soft-light";g.globalAlpha=.28;g.drawImage(linen,0,0);
    standards.set(mark,el);return el;
  }
  function drawWallStandards(s) {
    const linen=art.sprite("bannerLinen"), w=clothWidth, h=w*linen.height/linen.width;
    const drop=s.bannerDrop*s.bannerDrop*(3-2*s.bannerDrop);
    for (const left of [outerPier,outerPier+wingWidth+reliefWidth]) {
      const clothX=left+(wingWidth-w)/2;
      if (drop>0 && s.bannerTile) {
        ctx.save();ctx.beginPath();ctx.rect(clothX,railY,w,h);ctx.clip();
        ctx.drawImage(standardCloth(s.bannerTile),clothX,railY-h*(1-drop),w,h);
        ctx.restore();
      }
      // Recessed iron with a worn upper lip and two dark wall sockets.
      ctx.fillStyle="#292621";ctx.fillRect(left,railY-3,wingWidth,6);
      ctx.fillStyle="#675e50";ctx.fillRect(left,railY-3,wingWidth,2);
      for (const socket of [left,left+wingWidth-9]) {
        ctx.fillStyle="#49433a";ctx.fillRect(socket,railY-5,9,10);
      }
    }
  }
  function brazier(c,x,wallLane,{heat=0,furnace=0}) {
    const side=wallLane===0 ? 1 : -1;
    const wall=project(c,x,wallLane);
    const u=c.unit*wall.k;
    if (u<2 || wall.x < -u || wall.x > c.w+u) return;
    const t=game.time(), phase=(x+12)*1.9+wallLane;
    const pulse=.5+.5*Math.sin(t*8+phase)*Math.cos(t*5-phase);
    const w=u*.79,hBody=w*sconce.height/sconce.width;
    const h=u*(.38+pulse*.09+heat*.18+furnace**4*(.97+pulse*.27));
    if (game.effects()) {
      const flicker = reducedMotion.matches ? 0.5 : pulse;
      ctx.save();
      ctx.translate(wall.x + side * u * 0.37, wall.y);
      ctx.scale(1, 0.23);
      halo(0, 0, u * (0.85 + 0.12 * flicker), "rgba(246,144,67," + (0.13 + 0.11 * heat) + ")");
      ctx.restore();
    }
    // The forged plate touches the wall. Mirror the entire assembly around its mounting point.
    ctx.save();ctx.translate(wall.x,wall.y-u*1.57);ctx.scale(side,1);
    const left=-w*.13, bowlX=left+w*.661, bowlY=hBody*.229, bowlRadius=w*.28;
    ctx.globalCompositeOperation="screen";
    halo(bowlX*.45,bowlY-h*.14,u*(.73+.35*heat),"rgba(255,134,61,"+(.18+.16*heat)+")");
    ctx.globalCompositeOperation="source-over";
    ctx.drawImage(sconce,left,0,w,hBody);
    ctx.translate(bowlX,bowlY);
    ctx.globalCompositeOperation="screen";
    halo(0,-h*.22,Math.max(bowlRadius*2,h*.65),"rgba(255,128,28,"+(.23+.15*heat)+")");
    ctx.globalCompositeOperation="source-over";
    const frame=Math.floor(t*22+phase*3)%32;
    // The widest possible sprite is narrower than the iron lip, even at peak eruption.
    const half=bowlRadius*.85;
    ctx.drawImage(flameFrame(frame),-half,-h,half*2,h+u*.009);
    ctx.globalCompositeOperation="screen";
    ctx.drawImage(flameFrame((frame+11)%32),-half*.61,-h*.65,half*1.22,h*.65);
    halo(0,-bowlRadius*.25,bowlRadius*.67,"#fff7bdeb");
    ctx.globalCompositeOperation="source-over";
    for (let i=0;i<2+Math.round(4*furnace);i++) {
      const f=(t*(.55+i*.04)+phase+i*.37)%1;
      ctx.fillStyle='rgba(255,206,101,'+(1-f)+')';
      ctx.fillRect(Math.sin(phase+i*3+f*5)*half*f,-h*(.4+f),Math.max(1,u*.014),Math.max(1,u*.028));
    }
    ctx.restore();
  }
  let emberSprite;
  function drawEmber(x,y,radius) {
    if (!emberSprite) {
      emberSprite=surface(32,32);
      const g=emberSprite.getContext("2d"), glow=g.createRadialGradient(16,16,0,16,16,16);
      glow.addColorStop(0,"#fff0bb");glow.addColorStop(.19,"#ffdf8f");
      glow.addColorStop(.29,"#ffae43cc");glow.addColorStop(.6,"#ff78244a");glow.addColorStop(1,"#ff641700");
      g.fillStyle=glow;g.fillRect(0,0,32,32);
    }
    ctx.drawImage(emberSprite,x-radius,y-radius,radius*2,radius*2);
  }
  function drawCinders(c,s,finish) {
    const time=game.time();
    ctx.save();ctx.globalCompositeOperation="screen";
    const first=Math.max(1,Math.floor(player.x)-2),last=Math.min(finish,first+16);
    for (let x=first;x<last;x++) {
      const seed=x*11.73, rise=(time*(.68+(x%5)*.09)+seed)%1;
      const lane=(x*2.37+Math.sin(seed+rise*4)*.22)%4.8+.1;
      const p=project(c,x+.38,lane), u=c.unit*p.k;
      const dy=u*rise*(.5+s.furnace*.65);
      ctx.globalAlpha=s.furnace**3*(1-rise)*.83;
      drawEmber(p.x,p.y-dy,Math.max(1.8,u*.039));
    }
    ctx.restore();
  }
  const clouds=[];
  function smokeCloud(hot) {
    if (clouds[hot]) return clouds[hot];
    const vapor=surface(160,96);
    const g=vapor.getContext("2d"), pixels=g.createImageData(vapor.width,vapor.height);
    for (let y=0;y<vapor.height;y++) for (let x=0;x<vapor.width;x++) {
      const a=x/vapor.width,b=y/vapor.height;
      const folds=.57*noise(a*5+2,b*4)+.3*noise(a*11,b*9)+.13*noise(a*28,b*23);
      const edge=Math.max(0,1-(a*2-1)**2-(b*2-1)**2);
      const i=(y*vapor.width+x)*4, lit=Math.max(0,folds-.32);
      pixels.data[i]=hot?159+95*folds:80+72*lit;
      pixels.data[i+1]=hot?30+148*lit:83+68*lit;
      pixels.data[i+2]=hot?18+37*lit:88+68*lit;
      pixels.data[i+3]=Math.min(255,edge*lit*615);
    }
    g.putImageData(pixels,0,0);clouds[hot]=vapor;return vapor;
  }
  const smokeLayer=surface(1,1);
  let smokeFrame=-1;
  function drawSmoke(c,time,energy) {
    const frame=Math.floor(time*24), w=Math.min(384,Math.ceil(c.w/2));
    const h=Math.max(1,Math.ceil(w*c.h/c.w*.65));
    const resized=smokeLayer.width!==w || smokeLayer.height!==h;
    // The clouds are translucent and low-frequency. Composite them together at low resolution.
    if (frame!==smokeFrame || resized) {
      smokeFrame=frame;
      if (resized) {smokeLayer.width=w;smokeLayer.height=h;}
      const g=smokeLayer.getContext("2d");g.clearRect(0,0,w,h);g.globalCompositeOperation="screen";
      for (let i=0;i<9;i++) {
        const rise=(time*.12+i*.369)%1, width=w*(.44+.21*rise);
        const x=((i*.37+.09*Math.sin(i*7+rise*3))%1)*w, y=h/.65*(.34-rise*.52);
        const opacity=Math.sin(rise*Math.PI)*.82;
        if (energy<1) {
          g.globalAlpha=opacity*(1-energy)*.84;
          g.drawImage(smokeCloud(0),x-width*.5,y-width*.19,width,width*.39);
        }
        if (energy>0) {
          g.globalAlpha=opacity*energy;
          g.drawImage(smokeCloud(1),x-width*.5,y-width*.19,width,width*.39);
        }
      }
      g.globalAlpha=1;
    }
    ctx.drawImage(smokeLayer,0,0,c.w,c.h*.65);
  }
  function furnaceSky(c,s) {
    const energy=s.furnace;
    ctx.save();
    if (energy>0) {
      const gradient=ctx.createLinearGradient(0,0,0,c.h*.64);
      gradient.addColorStop(0,"#590f25");gradient.addColorStop(.40,"#bd2d15");
      gradient.addColorStop(.74,"#ff9234");gradient.addColorStop(1,"#70251d");
      ctx.globalAlpha=energy*.87;ctx.fillStyle=gradient;ctx.fillRect(0,0,c.w,c.h);
    }
    if (game.effects()) {
      const time=game.time();
      ctx.globalAlpha=1;ctx.globalCompositeOperation="screen";drawSmoke(c,time,energy);
      for (let i=0;energy>0 && i<48;i++) {
        const depth=(i*.75487767)%1;
        const rise=(time*(.12+.14*depth)+i*.631)%1;
        const drift=Math.sin(rise*6+i)*(.009+.017*depth);
        const x=c.w*((i*.618034+drift+1)%1), y=c.h*(.56-rise*.65);
        const radius=(1.6+4.1*depth)*Math.min(1.35,c.h/660);
        ctx.globalAlpha=energy*Math.sin(rise*Math.PI)*(.60+.38*depth);
        drawEmber(x,y,radius);
      }
    }
    ctx.restore();
  }
  function heatHaze(c,s) {
    if (!s.heat) return;
    ctx.save();ctx.globalCompositeOperation="screen";
    const g=ctx.createRadialGradient(c.w*.5,c.horizon,c.w*.03,c.w*.5,c.h*.48,Math.max(c.w,c.h)*.8);
    g.addColorStop(0,"#ff9b38");g.addColorStop(.4,"#a33212");g.addColorStop(1,"#681707");
    ctx.globalAlpha=s.furnace*.13;
    ctx.fillStyle=g;ctx.fillRect(0,0,c.w,c.h);
    ctx.restore();
  }
  function actor(type,index) {
    const statue=type==="statue";
    const source=statue ? art.sprite("pointingStatue") : figures;
    if (!source.naturalWidth) return null;
    const key = type+index;
    if (portraits.has(key)) return portraits.get(key);
    const sw=statue ? source.width : source.width/3, sh=source.height;
    const sx=type==="ghost" ? sw : 0;
    const el=surface(statue ? Math.round(400*sw/sh) : 216,400), g=el.getContext("2d");
    if (index !== 1) g.filter = index===0 ? "hue-rotate(135deg)" : "hue-rotate(192deg) saturate(1.5)";
    g.drawImage(source,sx,0,sw,sh,0,0,el.width,el.height);
    portraits.set(key,el); return el;
  }
  function traceDoorway(g,w,h) {
    g.beginPath();g.moveTo(-w*.255,-h*.034);g.lineTo(-w*.255,-h*.51);
    g.quadraticCurveTo(-w*.255,-h*.65,0,-h*.77);
    g.quadraticCurveTo(w*.255,-h*.65,w*.255,-h*.51);g.lineTo(w*.255,-h*.034);g.closePath();
  }
  let passageBloom;
  function innerPortalLight(time,energy) {
    if (!passageBloom) {
      passageBloom=surface(128,128);
      const g=passageBloom.getContext("2d"), glow=g.createRadialGradient(64,64,0,64,64,64);
      glow.addColorStop(0,"#fff2d8");glow.addColorStop(.28,"#e2efffe8");
      glow.addColorStop(.65,"#a5d1ff93");glow.addColorStop(1,"rgba(156,203,255,0)");
      g.fillStyle=glow;g.fillRect(0,0,128,128);
    }
    // Light wells up from the far arch and spreads into the illuminated part of the passage.
    const breath=.5+.5*Math.sin(time*1.65);
    const cx=.50+.045*Math.sin(time*.97), cy=.54+.035*Math.cos(time*1.31);
    const width=.94+.39*breath, height=.52+.33*breath;
    ctx.globalAlpha=energy*(.025+.64*breath);
    ctx.drawImage(passageBloom,cx-width/2,cy-height/2,width,height);
  }
  // A thin moving reflection bends the view of the passage without hiding its stonework.
  function drawPassage(w,h,time,energy) {
    const width=w*.51, height=h*.74, left=-width/2, top=-h*.77;
    const sourceWidth=passage.height*width/height, sourceLeft=(passage.width-sourceWidth)/2;
    const bands=24, bandHeight=height/bands, sourceBand=passage.height/bands;
    const wave=time*1.8;
    for (let i=0;i<bands;i++) {
      const bend=energy*sourceWidth*.012*Math.sin(i*.38+wave)*Math.sin(i*.19-wave*.46);
      ctx.drawImage(passage,sourceLeft+bend,i*sourceBand,sourceWidth,sourceBand,
        left,top+i*bandHeight,width,bandHeight+.5);
    }
    ctx.save();ctx.translate(left,top);ctx.scale(width,height);
    ctx.globalCompositeOperation="screen";
    innerPortalLight(time,energy);
    for (let i=0;i<2;i++) {
      const phase=(time*.22+i*.5)%1, y=1.13-phase*1.42;
      const glint=ctx.createLinearGradient(0,0,1,0);
      glint.addColorStop(0,"transparent");glint.addColorStop(.28,"#8eaec9");
      glint.addColorStop(.64,"#ebd5ac");glint.addColorStop(1,"transparent");
      ctx.strokeStyle=glint;
      ctx.beginPath();ctx.moveTo(-.07,y+.055);
      ctx.bezierCurveTo(.21,y-.16,.66,y+.16+Math.sin(wave+i)*.05,1.08,y-.07);
      const strength=energy*Math.sin(phase*Math.PI);
      ctx.globalAlpha=strength*.09;ctx.lineWidth=.038;ctx.stroke();
      ctx.globalAlpha=strength*.22;ctx.lineWidth=.008;ctx.stroke();
    }
    ctx.restore();
  }
  function drawPortal(open,x,y,w,h) {
    const time=game.time(), energy=open*open*(3-2*open);
    ctx.save();ctx.translate(x,y);
    traceDoorway(ctx,w,h);ctx.clip();
    const aperture=w*.51*open;
    ctx.beginPath();ctx.rect(-aperture/2,-h*.77,aperture,h*.74);ctx.clip();
    ctx.globalAlpha=open*(2-open);
    if (passage.naturalWidth) drawPassage(w,h,time,energy);
    ctx.restore();
  }
  const auraColors=["255,60,68","57,161,255","255,191,39"];
  const auras=[];
  function actorLight(x,y,h,index,pulse,ghost) {
    if (!auras[index]) {
      const el=surface(128,128),g=el.getContext("2d"),rgb=auraColors[index];
      const light=g.createRadialGradient(64,64,0,64,64,64);
      for (const [stop,alpha] of [[0,.85],[.38,.65],[.67,.24],[1,0]])
        light.addColorStop(stop,"rgba("+rgb+","+alpha+")");
      g.fillStyle=light;g.fillRect(0,0,128,128);auras[index]=el;
    }
    ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=.59+.32*pulse;
    const spread=h*((ghost ? .86 : .67)+.13*pulse);
    ctx.drawImage(auras[index],x-spread/2,y-h*1.06,spread,h*1.15);
    ctx.drawImage(auras[index],x-h*.40,y-h*.10,h*.8,h*.16);
    ctx.restore();
  }
  let grateFrame,ironBars,cryptGlow;
  function drawGrateLight(open) {
    if (!cryptGlow) {
      cryptGlow=surface(128,128);
      const g=cryptGlow.getContext("2d"), fog=g.createRadialGradient(64,64,0,64,64,64);
      fog.addColorStop(0,"#a6c8bb");fog.addColorStop(.23,"#82ab9ad4");
      fog.addColorStop(.53,"#627a9175");fog.addColorStop(1,"rgba(61,54,92,0)");
      g.fillStyle=fog;g.fillRect(0,0,128,128);
    }
    const t=game.effects() ? game.time() : 0;
    const strength=open*open*(3-2*open), pulse=.5+.5*Math.sin(t*1.45);
    ctx.save();
    ctx.fillStyle="rgba(18,14,34,"+(.24*strength)+")";ctx.fillRect(0,0,360,310);
    ctx.globalCompositeOperation="screen";
    ctx.globalAlpha=strength*(.30+.13*pulse);
    ctx.drawImage(cryptGlow,69+7*Math.sin(t*.61),70+4*Math.cos(t*.72),220,169);
    ctx.globalAlpha=strength*.22;
    ctx.drawImage(cryptGlow,57-6*Math.sin(t*.61),183,248,80);
    ctx.restore();
  }
  function grateOpening(g) {
    g.beginPath();g.moveTo(28,308);g.lineTo(28,115);
    g.bezierCurveTo(28,4,332,4,332,115);g.lineTo(332,308);g.closePath();
  }
  function drawGrate(x,y,w,h,open) {
    if (!grateFrame) {
      grateFrame=surface(360,310);const g=grateFrame.getContext("2d");
      g.save();g.beginPath();g.moveTo(8,310);g.lineTo(8,116);
      g.bezierCurveTo(8,-30,352,-30,352,116);g.lineTo(352,310);g.closePath();g.clip();
      for (let j=0;j<5;j++) for(let i=0;i<3;i++) g.drawImage(brick,i*160-(j%2)*80,j*80,160,80);
      g.globalCompositeOperation="destination-out";grateOpening(g);g.fill();g.restore();
      grateOpening(g);g.strokeStyle="#453d35";g.lineWidth=5;g.stroke();
      ironBars=surface(360,310);const iron=ironBars.getContext("2d");
      for (let bx=34;bx<=330;bx+=24) {
        const metal=iron.createLinearGradient(bx,0,bx+8,0);
        metal.addColorStop(0,"#121318");metal.addColorStop(.27,"#847f72");metal.addColorStop(.56,"#484849");metal.addColorStop(1,"#19191d");
        iron.fillStyle=metal;iron.beginPath();iron.moveTo(bx,0);iron.lineTo(bx+8,0);
        iron.lineTo(bx+8,292);iron.lineTo(bx+4,307);iron.lineTo(bx,292);iron.closePath();iron.fill();
      }
      for (const by of [80,169,256]) {
        iron.fillStyle="#302e30";iron.fillRect(24,by,312,9);iron.fillStyle="#706b60";iron.fillRect(24,by,312,2);
        for (let bx=38;bx<332;bx+=24) {iron.fillStyle="#93897a";iron.fillRect(bx-1,by+3,3,3);}
      }
    }
    ctx.save();ctx.translate(x-w/2,y-h);ctx.scale(w/360,h/310);
    ctx.save();grateOpening(ctx);ctx.clip();
    ctx.fillStyle="#19161b";ctx.fillRect(0,0,360,310);
    if (passage.naturalWidth) ctx.drawImage(passage,22,15,316,295);
    ctx.fillStyle="rgba(19,16,20,.38)";ctx.fillRect(0,0,360,310);
    if (open>0) drawGrateLight(open);
    ctx.drawImage(ironBars,0,-308*open);ctx.restore();
    ctx.drawImage(grateFrame,0,0);ctx.restore();
  }
  function eyePlate(c) {
    const img=art.sprite("eyeRoom");
    const scale=Math.max(c.w/img.width,c.h/img.height)*(1+.31*Math.min(1,(player.x-.5)/9));
    const w=img.width*scale,h=img.height*scale;
    return {img,w,h,left:(c.w-w)*.5+(2.5-player.y)*c.unit*.08,top:(c.h-h)*.42};
  }
  function watchHall(c,s) {
    const p=eyePlate(c),t=game.effects() && !reducedMotion.matches ? game.time() : 0;
    ctx.drawImage(p.img,p.left,p.top,p.w,p.h);
    halo(p.left+p.w*.5,p.top+p.h*.13,p.h*(.15+.012*Math.sin(t*1.35)),"#9fdabb63");
    const flame=art.sprite("livingFlames");
    for(const u of [.333,.677]) {
      const index=Math.floor(t*12+u*31)%8,sw=flame.width/4,sh=flame.height/2;
      const x=p.left+u*p.w,y=p.top+p.h*.60,size=p.h*.085;
      ctx.drawImage(flame,index%4*sw,Math.floor(index/4)*sh,sw,sh,x-size*.45,y-size,size*.9,size);
      halo(x,y,p.h*.061,"#eeb26762");
    }
    if(game.effects() && !reducedMotion.matches && !s.waiting){
      const awake=CastleScenes.eye.lids(s.timer,s.eyePeriod);
      const x=p.left+p.w*.5, y=p.top+p.h*.724;
      ctx.save();ctx.translate(x,y);ctx.scale(1,.19);
      halo(0,0,p.h*(.20+.16*awake),awake>.5?"#ecaa5260":"#8ac9c33a");ctx.restore();
      for(let i=0;i<12;i++){
        const f=(i*.31+t*.09)%1;
        const u=.35+(i*.618%1)*.26+.026*Math.sin(7*f+i);
        halo(p.left+p.w*u,p.top+p.h*(.61-f*.12),Math.max(1,p.h*.0027),awake>.5?"#edc88194":"#9be8e47a");
      }
    }
    // Safe landings keep their position as Coji walks; the latest one glows.
    for(let i=1;i<=3;i++){
      const pt=project(c,.5+i*3,2.5);if(pt.k<=0||pt.y>c.h)continue;
      ctx.save();ctx.translate(pt.x,pt.y);ctx.scale(1,.25);
      halo(0,0,c.unit*pt.k*.57,i<=s.section?"#a1eea97d":"#dfc4834f");ctx.restore();
    }
  }
  function watchEye(c,item) {
    const p=eyePlate(c),size=p.h*.252,x=p.left+p.w*.5,y=p.top+p.h*.431;
    const img=art.sprite("eyeBlink"),cell=img.width/3,index=Math.round(item.lid*5);
    ctx.drawImage(img,index%3*cell,Math.floor(index/3)*cell,cell,cell,x-size/2,y-size/2,size,size);
    const t=game.effects()?game.time():0;
    if(item.lid>.1)halo(x,y,size*(.32+.035*Math.sin(t*3)),"#e4af533b");
    hits.push({item,x:x-size/2,y:y-size/2,w:size,h:size});
  }
  function fixture(c,item) {
    if(item.type==="eye"){watchEye(c,item);return;}
    const p = project(c,item.x,item.y);
    if (p.k <= 0 || item.x < player.x-1) return;
    const u = Math.min(c.h*.34,c.w*.42)*p.k;
    let h = u, w = u*.53, y = p.y;
    let image = null;
    switch (item.type) {
      case "scroll": image=art.lectern; h=u*.56; w=h*.92; break;
      case "keeper": image=actor("give",1); h=u*.86; w=h*.54; break;
      case "exit": h=c.unit*p.k*gateHeight; w=h*gateAspect; break;
      case "passage": image=art.arch; h=c.unit*p.k*gateHeight; w=h*gateAspect; break;
      case "grate": h=c.unit*p.k*3.65;w=c.unit*p.k*4.1;break;
      case "ghost": case "give": case "statue":
        image=actor(item.type,item.index);h=Math.min(u*.90,c.unit*p.k*1.85);
        if (item.type==="statue") h*=1.18;
        w=image ? h*image.width/image.height : h*.54;break;
      case "key": case "crystal":
        image=art.sprite(offeringArt[item.type]);
        w=Math.min(u*.52,c.unit*p.k*(item.type==="key" ? .95 : .57));
        h=image.width ? w*image.height/image.width : w;break;
      default: return;
    }
    const base={scroll:lecternBase,keeper:.95,give:.95,statue:.993,exit:gateBase,passage:gateBase}[item.type] ?? 1;
    y+=h*(1-base);
    if (["ghost","give","statue"].includes(item.type)) {
      const t=game.effects() ? game.time() : 0;
      const pulse=.5+.5*Math.sin(t*2.7+item.index*2);
      if (item.type==="ghost") {
        if (game.effects()) {
          ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.20);
          halo(0,0,h*(.35+.04*pulse),["#ea977538","#8ebafd48","#ffd9883e"][item.index]);
          ctx.restore();
        }
        y-=h*.04*(1+pulse);
      }
      actorLight(p.x,y,h,item.index,pulse,item.type==="ghost");
    }
    if (item.type==="grate") drawGrate(p.x,p.y,w,h,item.open);
    if (item.type==="key" || item.type==="crystal") shadow(p.x,p.y-1,w*.49);
    if (item.type==="scroll") {
      halo(p.x,y-h*.82,h*.62,"#ffbb5852");
      // The stone plinth bears weight behind its two front toes.
      shadow(p.x,y-h*.105,w*.40);
    }
    // The pointing hand extends beyond the plinth. Anchor the masonry at its foot in either pose.
    const imageX=item.type==="statue" ? p.x+(item.bridge===0 ? -.16 : .16)*w : p.x;
    if (image?.width) {
      ctx.save(); ctx.translate(imageX,y);
      if (item.type === "statue" && item.bridge === 0) ctx.scale(-1,1);
      if (base<1) drawFootContact(ctx,image,-w/2,-h,w,h);
      if (item.lean) ctx.rotate(item.lean);
      ctx.drawImage(image,-w/2,-h,w,h);
      ctx.restore();
    }
    if (item.open>0 && item.type!=="grate") drawPortal(item.open,p.x,y,w,h);
    if (item.speech) {
      const font=Math.max(12,Math.min(17,h*.15));
      ctx.save();ctx.font="italic 600 "+font+"px Georgia";ctx.textAlign="center";
      const margin=ctx.measureText(item.speech).width/2+4;
      const tx=Math.max(margin,Math.min(c.w-margin,p.x)),ty=Math.max(font+3,y-h-6);
      ctx.lineWidth=3;ctx.strokeStyle="#15121e";ctx.strokeText(item.speech,tx,ty);
      ctx.fillStyle="#fbf4df";ctx.fillText(item.speech,tx,ty);ctx.restore();
    }
    if (item.label) {
      const fs=Math.max(9,Math.min(16,h*.16));
      ctx.save();ctx.font="600 "+fs+"px system-ui";ctx.textAlign="center";ctx.textBaseline="top";
      ctx.lineWidth=3;ctx.strokeStyle="#181315";ctx.strokeText(item.label,p.x,p.y+2);
      ctx.fillStyle="#fff2d4";ctx.fillText(item.label,p.x,p.y+2);ctx.restore();
    }
    const pad=item.type==="scroll" || (item.type==="keeper" && item.x-player.x<5) ? Math.max(0,(44-w)/2) : 0;
    hits.push({item, x:imageX-w/2-pad,y:y-h-pad,w:w+2*pad,h:h+2*pad+(item.label ? 17 : 0)});
  }
  function coji(c,s) {
    const p = project(c,player.x,player.y);
    const {frame,mirror} = cojiFrameForFacing(currentCojiFrames(),player.facing);
    const h = Math.min(c.h*.18,c.w*.29), w = h*frame.width/frame.height;
    const foot = h*frame.footInset/frame.height;
    if (s.flight) shadow(p.x,p.y,w*.19);
    ctx.save(); ctx.translate(p.x,p.y); ctx.scale(mirror ? -1 : 1,1);
    if (s.flight) {
      const f=Math.min(1,s.flight/1.27);
      ctx.translate(Math.sin(f*5)*w*.23,-c.h*(.3*f+.95*f*f));
      ctx.rotate(f*.68);ctx.scale(1-f*.55,1-f*.55);
    }
    if (!s.flight) drawFootContact(ctx,frame.image,-w/2,-h+foot,w,h,frame);
    drawFrame(frame,-w/2,-h+foot,w,h);
    ctx.restore();
    if (s.id!=="lava" && !s.journey) hits.push({item:{type:"coji"},x:p.x-w*.18,y:p.y-h*.94,w:w*.36,h:h*.94});
    return {x:p.x,y:p.y-h+foot};
  }
  let cryptMasonry;
  function drawJourneyWall(c,depth) {
    if (!cryptMasonry) {
      const tile=surface(256,256), g=tile.getContext("2d");
      g.drawImage(brick,0,0,256,128);
      for (const x of [-128,128]) g.drawImage(brick,x,128,256,128);
      cryptMasonry=ctx.createPattern(tile,"repeat");
    }
    const p=project(c,depth,lanes/2), unit=c.unit*p.k, scale=unit/64;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
    const top=-Math.max(768,p.y/scale), bottom=Math.max(1,(c.h-p.y)/scale);
    ctx.fillStyle=cryptMasonry;ctx.fillRect(-512,top,1024,bottom-top);
    const shade=ctx.createRadialGradient(0,-90,45,0,-90,635);
    shade.addColorStop(0,"#19161933");shade.addColorStop(1,"#100e15e8");
    ctx.fillStyle=shade;ctx.fillRect(-512,top,1024,bottom-top);ctx.restore();
  }
  function draw(s,tileAt,finish,puzzle) {
    watchingEye=s.id==="eye";
    lanes=s.width || 5;
    entryView=s.entrance ? s : null;
    const c = camera();
    if (lastBoard!==s.board) {rows.clear();lastBoard=s.board;}
    hits = []; ctx.save();
    ctx.fillStyle="#171518"; ctx.fillRect(0,0,c.w,c.h);
    const lava=s.id==="lava";
    const end = lava ? s.landingEnd-1 : s.journey ? 11 : 12;
    const ambient = ctx.createLinearGradient(0,0,0,c.h);
    ambient.addColorStop(0,"#111016"); ambient.addColorStop(.42,"#302a2c");
    ambient.addColorStop(1,"#100f14"); ctx.fillStyle=ambient; ctx.fillRect(0,0,c.w,c.h);
    const gateDepth=end+1-gateSetback;
    const back = project(c,end+1,0), width = 5*c.unit*back.k;
    if (s.id==="eye") watchHall(c,s);
    else {
      if (lava) { furnaceSky(c,s); drawCellarWall(c,gateDepth,s); }
      else if (s.journey) drawJourneyWall(c,gateDepth);
      else if (shrine.naturalWidth) ctx.drawImage(shrine,back.x,back.y-width*.46,width,width*.46);
      drawFloor(c,s,tileAt,finish,end);
      if (lava && s.furnace>0) drawCinders(c,s,finish);
      drawArcade(c,end,s);
      if (lava) floorLightOnWalls(c,s,finish);
    }
    const goal = player.path.at(-1);
    if (goal) {
      const p = project(c,goal.x,goal.y);
      if (p.k > 0) {
        const radius = Math.max(4,c.unit*p.k*.34);
        ctx.beginPath(); ctx.ellipse(p.x,p.y,radius,radius*.46,0,0,Math.PI*2);
        ctx.fillStyle="#f9da893d"; ctx.fill(); ctx.strokeStyle="#ffda86"; ctx.lineWidth=2; ctx.stroke();
      }
    }
    const actors = lava ? [
      {type:"exit",x:gateDepth,y:2.5,open:s.gateOpen},
      {type:"keeper",x:finish+3.5,y:1.5}
    ] : puzzle;
    if (s.journey) {
      for (const x of [2,8.5]) if (x>=player.x-2)
        for (const y of [0,lanes]) actors.push({type:"brazier",x,y});
    }
    if (lava) {
      for (let x=s.entrance.start+3;x<end;x+=5) {
        if (x<player.x-2 || x>player.x+32) continue;
        for (const y of [0,lanes]) actors.push({type:"brazier",x,y});
      }
      heatHaze(c,s);
    }
    if (!s.waiting && s.light>=1) actors.push({type:"player",x:player.x,y:player.y});
    let head;
    actors.sort((a,b)=>b.x-a.x).forEach(item=>{
      if (item.type==="brazier") brazier(c,item.x,item.y,s);
      else if (item.type==="player") head=coji(c,s);
      else fixture(c,item);
    });
    if (s.light<1) {
      ctx.globalAlpha=1-s.light;
      if (lava) {
        const threshold=Math.max(0,Math.min(.96,project(c,s.entrance.end,2.5).y/c.h));
        const veil=ctx.createLinearGradient(0,0,0,c.h);
        veil.addColorStop(0,"rgba(4,4,9,.83)");veil.addColorStop(threshold,"rgba(4,4,9,.91)");
        veil.addColorStop(Math.min(.96,threshold+.13),"rgba(7,8,13,.29)");veil.addColorStop(1,"rgba(7,8,13,.15)");
        ctx.fillStyle=veil;
      } else ctx.fillStyle="rgba(4,4,9,.93)";
      ctx.fillRect(0,0,c.w,c.h);ctx.globalAlpha=1;
    }
    if (s.waiting) {
      ctx.save();
      fixture(c,{type:"scroll",...(lava?s.entrance.scroll:{x:2.7,y:lanes/2})});
      ctx.restore();
    }
    if (s.waiting || s.light<1) head=coji(c,s);
    if (s.journey?.heldOffering && !s.flight) {
      const image=art.sprite(offeringArt[s.journey.heldOffering]);
      const size=Math.max(22,Math.min(32,c.w*.065,c.h*.045));
      const scale=size/Math.max(image.width,image.height);
      const w=image.width*scale,h=image.height*scale;
      ctx.save();ctx.shadowColor="rgba(12,9,8,.85)";ctx.shadowBlur=3;ctx.shadowOffsetY=1;
      ctx.drawImage(image,head.x-w/2,head.y-h-5,w,h);ctx.restore();
    }
    if (s.journey?.fade) {
      const f=s.journey.fade;ctx.globalAlpha=f*f*(3-2*f);
      ctx.fillStyle="#0b0a10";ctx.fillRect(0,0,c.w,c.h);ctx.globalAlpha=1;
    }
    ctx.restore();
    return head;
  }
  function hit(p) {
    for (let i=hits.length-1;i>=0;i--) {
      const h=hits[i];
      if (p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h) return h.item;
    }
    return null;
  }
  return {draw,hit,ground};
};
