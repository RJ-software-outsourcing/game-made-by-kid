CastleScenes.procession = (() => {
  const colors = ["red", "blue", "gold"];
  const offerings = ["key", "crystal"];
  const calls = ["Follow me.", "This way.", "Come with me."];
  const warnings = [
    {clip:"halt",text:"Halt! The gate is sealed."},
    {clip:"offering",text:"Where is your offering?"},
    {clip:"back",text:"Stand back, traveler."}
  ];
  const width = 7, middle = width/2, doorX = 11.65;
  const doorLane = side => middle + (side ? 1.85 : -1.85);
  const rules = colors.flatMap((color, knight) => offerings.map((offering, i) => {
    const ghost = (knight+i+1)%3;
    const others = colors.filter(name => name!==color);
    const knightClue = (knight+i)%2 ? "the knight wearing neither "+others.join(" nor ") : "the "+color+" knight";
    // Only two statues appear. A single exclusion therefore identifies exactly one.
    const statue = (ghost+i)%3, decoy = (statue+1+i)%3;
    const statueClue = i ? "Ignore the "+colors[decoy]+" statue. Go where the other points." :
      "Take the door the "+colors[statue]+" statue points to.";
    return {label:color[0].toUpperCase()+color.slice(1)+" knight · "+offering, ghost, knight, offering, statue, decoy,
      text:"Follow the "+colors[ghost]+" ghost. Give the "+offering+" to "+knightClue+". "+statueClue};
  }));
  const chambers = [
    {key:"ghostGallery",name:"幽靈引路",hint:"Choose your guide."},
    {key:"knightGallery",name:"守衛交付",hint:"Choose an offering for the knight.",assets:["offeringKey","offeringCrystal"]},
    {key:"whisperVault",name:"低語之室",hint:"Which statue will you trust?",assets:["pointingStatue"]}
  ];
  function create(s,game,enter,win) {
    const player=game.player;
    const voices=colors.map(color=>new Audio("assets/ghost-"+color+".mp3"));
    let chamber=0, hand=null, intent=null, guide=null, following=false, guideX=3.5, nextStep=0;
    let accepted=false, open=0, chosenDoor=null, blocker=null, blockLane=middle;
    let fade=0, destination=null, failure="", callTimer=0, speaker=null;
    let exitSide, trueStatueSide;
    const lane=i=>middle+(((i+s.orderOffset)%3)-1)*2;
    const postX=7.8, blockX=6.95;
    let guards=[], guardVoice=null, warningTime=0, nextWarning=0;
    function guideLane() {
      const travel=guideX-3.5;
      return middle+(lane(guide)-middle)*Math.max(0,1-travel/3)+.5*Math.sin(travel*Math.PI/4);
    }
    function quiet() {
      for (const voice of voices) voice.pause();
      if (guardVoice) guardVoice.pause();
      speaker=null;
    }
    function prime() {
      for (const voice of voices) {
        voice.muted=true;
        voice.play().then(()=>{
          // The first invitation can start while gesture-based audio unlocking is pending.
          if (voice!==voices[speaker]) {voice.pause();voice.currentTime=0;}
        }).catch(()=>{});
      }
    }
    function visit(index) {
      chamber=index;intent=null;following=false;open=0;chosenDoor=null;
      if (index===0) {
        guide=null;guideX=3.5;hand=null;accepted=false;blocker=null;callTimer=0;
        trueStatueSide=Math.random()<.5 ? 0 : 1;
        exitSide=Math.random()<.5 ? 0 : 1;
      }
      if (index===1) {
        guards=colors.map((_,i)=>({type:"give",index:i,x:postX,y:lane(i),stride:0,lean:0,speech:null}));
        warningTime=0;nextWarning=0;
      }
      quiet();game.stop();
      enter(chambers[index],s.waiting,failure);
      failure="";
    }
    function change(index,reason="") {
      destination=index;failure=reason;game.stop();quiet();
    }
    function hint(text) { game.view().hint=game.roomHint.textContent=text; }
    function objects() {
      if (chamber===0) {
        const ghosts=colors.map((color,i)=>({
          type:"ghost",index:i,x:guide===i ? guideX : 3.5, y:guide===i ? guideLane() : lane(i),
          speech:speaker===i ? calls[i] : null
        }));
        return [...ghosts,{type:"grate",x:doorX,y:middle,open:guide===null ? 0 : Math.min(1,Math.max(0,(guideX-8.5)/2))}];
      }
      if (chamber===1) {
        const items=offerings.map((type,i)=>({type,x:3.5,y:doorLane(i),label:type})).filter(item=>item.type!==hand && !accepted);
        return [...items,...guards,{type:"passage",x:doorX,y:middle,open}];
      }
      return [0,1].flatMap(i=>{
        const trusted=i===trueStatueSide;
        return [{type:"statue",index:trusted ? s.rule.statue : s.rule.decoy,x:5.5,y:doorLane(i),bridge:trusted ? exitSide : 1-exitSide},
          {type:"passage",index:i,x:doorX,y:doorLane(i),open:i===chosenDoor ? open : 0}];
      });
    }
    function walkable(x) {
      if (chamber===0) return x<=Math.min(11,Math.ceil(guideX));
      return x<=(chamber===1 && !accepted ? 6 : 11);
    }
    function walk(x,y) { player.path=game.findPath(player.x,player.y,x,y); }
    function cancel() {intent=null;following=false;}
    function intercept(y) {
      blockLane=Math.max(.65,Math.min(width-.65,y));
      const distance=guard=>Math.hypot(guard.x-blockX,guard.y-blockLane);
      blocker=guards.reduce((closest,guard)=>distance(guard)<distance(closest) ? guard : closest);
      if (warningTime<=0) {
        const warning=warnings[nextWarning++%warnings.length];
        for (const guard of guards) guard.speech=null;
        blocker.speech=warning.text;warningTime=2.5;
        if (guardVoice) guardVoice.pause();
        guardVoice=new Audio("assets/guard-"+warning.clip+".mp3");
        guardVoice.play().catch(()=>{});
      }
      walk(6.5,blockLane);
      hint("The knight bars your way. Bring an offering.");
    }
    function moveGuards(dt) {
      warningTime=Math.max(0,warningTime-dt);
      for (const guard of guards) {
        if (!warningTime) guard.speech=null;
        const blocking=!accepted && guard===blocker;
        let targetY=blocking ? blockLane : lane(guard.index);
        if (accepted && guard.index===s.rule.knight) targetY+=targetY<middle ? -.8 : .8;
        // A knight receiving an offering waits where Coji approached him.
        const dx=(blocking ? blockX : postX)-guard.x, dy=targetY-guard.y;
        const distance=Math.hypot(dx,dy);
        const step=intent===guard ? 0 : Math.min(distance,dt*1.2);
        if (step>0) {
          guard.x+=dx/distance*step;guard.y+=dy/distance*step;
          guard.stride+=step*Math.PI/.30;
        }
        const lean=step>0 ? Math.sin(guard.stride)*.028 : 0;
        guard.lean+=(lean-guard.lean)*(1-Math.exp(-dt*18));
      }
    }
    function ground(point) {
      if (chamber!==1 || accepted) return false;
      if (point.x<7) {blocker=null;return false;}
      intercept(point.y);return true;
    }
    function choose(item) {
      game.stop();
      if (item.type==="grate") {
        if (guide===null) return game.showMessage("Choose a guide first.");
        following=true;nextStep=0;return;
      }
      if (item.type==="ghost" && guide!==null) {following=true;nextStep=0;return;}
      if (chamber===1 && !accepted && (item.type==="passage" || (item.type==="give" && !hand))) {
        intercept(item.y);return;
      }
      if (item.type==="give" && accepted) return game.showMessage("You may pass.");
      if (offerings.includes(item.type)) blocker=null;
      intent=item;walk(item.x-(item.type==="passage" ? 0 : .65),item.y);
    }
    function act(item) {
      if (item.type==="ghost") {
        guide=item.index;following=true;nextStep=0;quiet();
        hint("Follow your guide through the iron gate.");
      } else if (offerings.includes(item.type)) {
        hand=item.type;hint("Carrying the "+hand+". Choose a knight.");
      } else if (item.type==="give") {
        if (hand!==s.rule.offering || item.index!==s.rule.knight) {
          game.stop();s.flight=.001;game.showMessage("The offering is refused!");return;
        }
        hand=null;accepted=true;quiet();for (const guard of guards) guard.speech=null;
        hint("The gate is open. Walk through.");game.showMessage("You may pass.");
      } else if (item.type==="statue") {
        const clue=item.bridge===0 ? "Take the left door." : "Take the right door.";
        game.showMessage("The "+colors[item.index]+" statue whispers: “"+clue+"”");
      }
    }
    function update(dt) {
      if (destination!==null) {
        fade=Math.min(1,fade+dt/.45);
        if (fade===1) {const next=destination;destination=null;s.flight=0;visit(next);}
        return;
      }
      if (fade>0) {fade=Math.max(0,fade-dt/.55);return;}
      if (s.flight) {
        s.flight+=dt;
        if (s.flight>=1.27) change(0,"The knights sent you back. Choose your guide again.");
        return;
      }
      if (intent) {
        const live=intent;
        if (Math.hypot(player.x-live.x,player.y-live.y)<(live.type==="passage" ? .8 : 1.65)) {
          intent=null;game.stop();act(live);
        }
      }
      if (chamber===0 && guide===null) {
        const previous=Math.floor(callTimer/2.2);callTimer+=dt;
        const turn=Math.floor(callTimer/2.2);
        if (speaker===null || previous!==turn) {
          speaker=turn%3;const voice=voices[speaker];voice.currentTime=0;voice.muted=false;voice.play().catch(()=>{});
        }
      } else if (chamber===0) {
        if (Math.hypot(player.x-guideX,player.y-guideLane())<3.1) guideX=Math.min(11.5,guideX+dt*2.2);
        if (following) {nextStep-=dt;if (nextStep<=0) {walk(guideX,guideLane());nextStep=.42;}}
        if (guideX>=11.4 && Math.hypot(player.x-11.5,player.y-middle)<.75) {
          if (guide===s.rule.ghost) change(1);
          else change(0,"A false guide! Choose your guide again.");
        }
      } else if (chamber===1) {
        moveGuards(dt);
        if (accepted) {
          open=Math.min(1,open+dt*1.5);
          if (open===1 && Math.hypot(player.x-11.5,player.y-middle)<.75) change(2);
        }
      } else {
        const side=player.y<middle ? 0 : 1;
        if (Math.hypot(player.x-doorX,player.y-doorLane(side))<.8) {
          if (side!==exitSide) return change(0,"The door led you back. Choose your guide again.");
          chosenDoor=side;open=Math.min(1,open+dt*1.8);
          if (open===1) win();
        }
      }
    }
    return {visit,objects,walkable,choose,cancel,ground,update,prime,quiet,get heldOffering(){return hand;},
      get chamber(){return chamber;},get fade(){return fade;},get locked(){return destination!==null || fade>0 || !!s.flight;}};
  }
  return {assets:["trialFigures","trialBrick","gatePassage","emberSconce"],width,hint:chambers[0].hint,rules,create};
})();
