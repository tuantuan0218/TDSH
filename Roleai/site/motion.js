(() => {
  'use strict';
  const canvas = document.getElementById('sound');
  const ctx = canvas.getContext('2d');
  const brandCanvas = document.getElementById('brand-layer');
  const brandCtx = brandCanvas.getContext('2d');
  const opening = document.querySelector('.opening');
  const stage = document.querySelector('.stage');
  const hero = document.querySelector('.hero-copy');
  const heroEyebrow = document.getElementById('hero-eyebrow');
  const heroTitle = document.getElementById('hero-title');
  const heroIntro = document.getElementById('hero-intro');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches;
  let width = 0, height = 0, progress = 0, last = 0, time = 0, frame = 0;
  let visible = true, maxScroll = 1, sectionTop = 0, copyTravel = 0, handoffProgress = .5;
  let alternateCopy = false;
  const pointer = {x:0, y:0, targetX:0, targetY:0};
  // Complete the crossing before sticky releases; the final 20% is a landing hold.
  const crossingFraction = .8;
  const copy = {
    opening: {
      eyebrow: '编曲 · 配音 · 声音制作',
      title: '与 AI 一起，<br><span>把灵感做成作品。</span>',
      intro: '从第一段旋律、第一句台词，到完整的声音作品。'
    },
    landed: {
      eyebrow: '从灵感，到可编辑工程',
      title: 'AI 进入工程，<br><span>创作仍由你掌控。</span>',
      intro: '让 AI 推进创作，把每一次选择都留在你的手中。'
    }
  };
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  if (!ctx || !brandCtx) return;
  document.documentElement.classList.add('enhanced');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    brandCanvas.width = Math.round(width * ratio); brandCanvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    brandCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    sectionTop = opening.offsetTop;
    maxScroll = Math.max(1, opening.offsetHeight - height);
    const copyRoom = width - hero.offsetLeft - hero.offsetWidth - Math.max(24, width * .035);
    copyTravel = Math.max(0, Math.min(Math.min(width * .9, 1440) * .58, copyRoom));
    handoffProgress = copyTravel > 0
      ? clamp((width * .5 - hero.offsetLeft - hero.offsetWidth * .5) / copyTravel, .25, .75)
      : .5;
    pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
    syncScroll(); schedule();
  }

  function syncScroll() {
    const staticLayout = media.matches || width <= 700;
    progress = staticLayout ? 0 : clamp((scrollY - sectionTop) / (maxScroll * crossingFraction));
    // Scroll choreography must not trail native scrolling behind the ambient FPS gate.
    updateCopy();
    if (visible && !document.hidden) paint();
  }

  function paintFramework() {
    // Structural line study of the real workspace screenshot: toolbar, track heads,
    // timeline above the docked mixer. Decorative only; no invented project data.
    const mobile = width <= 700;
    const x = width * .025, y = height * .105;
    const w = width * .95, h = height * .76;
    const X = value => x + value * w;
    const Y = value => y + value * h;
    const line = (ax, ay, bx, by) => {ctx.moveTo(X(ax), Y(ay));ctx.lineTo(X(bx), Y(by));};
    const box = (ax, ay, bw, bh) => {ctx.rect(X(ax), Y(ay), bw * w, bh * h);};
    const ink = ctx.createLinearGradient(0, y, 0, y + h);
    ink.addColorStop(0, 'rgba(184,197,199,0)');
    ink.addColorStop(.1, 'rgba(184,197,199,.14)');
    ink.addColorStop(.3, 'rgba(184,197,199,.045)');
    ink.addColorStop(.52, 'rgba(184,197,199,.04)');
    ink.addColorStop(.8, 'rgba(184,197,199,.19)');
    ink.addColorStop(1, 'rgba(184,197,199,0)');
    ctx.strokeStyle = ink;
    ctx.lineWidth = .8;
    ctx.beginPath();
    box(0, 0, 1, 1);
    for (const edge of [.028,.08,.115,.145,.43,.46,.96]) line(0, edge, 1, edge);
    // Toolbar groups and transport display, without tiny text or false readouts.
    for (let i = 0; i < (mobile ? 5 : 8); i++) box(.016 + i * .025, .044, .014, .021);
    box(.29, .038, .15, .032);
    for (let i = 0; i < 6; i++) box(.48 + i * .045, .044, .016, .021);
    for (let i = 0; i < 6; i++) box(.016 + i * .078, .09, .062, .014);
    // Overview, ruler and track headers use the reference screenshot's 13% sidebar.
    line(.13, .115, .13, .43);
    box(.134, .121, .862, .017);
    const trackTop = .145;
    const trackHeight = (.43 - trackTop) / 4;
    for (let row = 0; row < 4; row++) {
      const top = trackTop + row * trackHeight;
      line(0, top, 1, top);
      if (!mobile) {
        for (let i = 0; i < 4; i++) box(.01 + i * .019, top + .024, .012, .012);
        line(.093, top + .03, .118, top + .03);
      }
    }
    // Mixer channels: pan rings, insert slots, long faders and adjacent meter rails.
    const channels = mobile ? 6 : 13;
    const channelWidth = 1 / channels;
    for (let channel = 0; channel < channels; channel++) {
      const left = channel * channelWidth;
      line(left, .46, left, .96);
      const center = X(left + channelWidth * .3);
      const panY = Y(.523), radius = Math.min(channelWidth * w * .07, 7);
      ctx.moveTo(center + radius, panY);
      ctx.arc(center, panY, radius, 0, Math.PI * 2);
      for (let slot = 0; slot < 3; slot++) box(left + channelWidth * .08, .57 + slot * .029, channelWidth * .79, .019);
      line(left + channelWidth * .48, .705, left + channelWidth * .48, .935);
      box(left + channelWidth * .36, .774, channelWidth * .24, .008);
      box(left + channelWidth * .8, .69, channelWidth * .045, .245);
    }
    ctx.stroke();
    // Timeline divisions use their own very quiet pass so they support rhythm
    // without competing with clips, the playhead or track-head controls.
    ctx.beginPath();
    for (let i = 0; i <= (mobile ? 8 : 28); i++) {
      const column = .134 + i / (mobile ? 8 : 28) * .862;
      line(column, trackTop, column, .43);
    }
    ctx.strokeStyle = mobile ? 'rgba(184,197,199,.018)' : 'rgba(184,197,199,.025)';
    ctx.lineWidth = .55;
    ctx.stroke();
    // Active timeline layer: the playhead advances through a stable arrangement.
    // Clips stay fixed, matching professional DAW playback where the cursor moves
    // across the timeline unless the user explicitly enables follow/scroll mode.
    const playhead = .134 + ((time * .034) % 1) * .862;
    ctx.beginPath();
    line(playhead, .145, playhead, .43);
    ctx.strokeStyle = 'rgba(224,232,232,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(224,232,232,.22)';
    ctx.beginPath();
    ctx.moveTo(X(playhead) - 4, Y(.145));
    ctx.lineTo(X(playhead) + 4, Y(.145));
    ctx.lineTo(X(playhead), Y(.154));
    ctx.closePath();
    ctx.fill();
    // A fixed but intentionally uneven arrangement reads like a real edit:
    // phrases enter at different beats and use varied lengths instead of forming
    // a repeated matrix. It remains deterministic so playback never shifts it.
    const clipPattern = [
      [[.01, .16], [.225, .08], [.40, .19], [.73, .11]],
      [[.065, .09], [.27, .17], [.53, .07], [.665, .21]],
      [[.005, .07], [.145, .20], [.47, .12], [.755, .15]],
      [[.09, .18], [.36, .06], [.515, .18], [.825, .085]],
    ];
    const clipCount = mobile ? 3 : 4;
    ctx.lineWidth = .8;
    for (let row = 0; row < 4; row++) {
      for (let clip = 0; clip < clipCount; clip++) {
        const [patternStart, patternWidth] = clipPattern[row][clip];
        const clipStart = .145 + patternStart * .82;
        const clipWidth = patternWidth * .82;
        const visibleWidth = Math.max(0, Math.min(.99 - clipStart, clipWidth));
        if (visibleWidth <= 0) continue;
        const clipTop = trackTop + .009 + row * trackHeight;
        const clipHeight = trackHeight * .55;
        ctx.fillStyle = `rgba(184,197,199,${.018 + row * .008})`;
        ctx.fillRect(X(clipStart), Y(clipTop), visibleWidth * w, clipHeight * h);
        ctx.strokeStyle = `rgba(184,197,199,${.075 + row * .016})`;
        ctx.strokeRect(X(clipStart), Y(clipTop), visibleWidth * w, clipHeight * h);
      }
    }
    // Independent low-level meter motion echoes the docked console without
    // presenting fictional measurements or readable values.
    for (let channel = 0; channel < channels; channel++) {
      const left = channel * channelWidth;
      const pulse = .16 + .84 * Math.pow((Math.sin(time * (1.05 + channel % 3 * .08) + channel * 1.37) + 1) / 2, 2.2);
      const meterHeight = .205 * pulse;
      ctx.fillStyle = `rgba(184,197,199,${.045 + pulse * .075})`;
      ctx.fillRect(X(left + channelWidth * .802), Y(.925 - meterHeight), Math.max(1, channelWidth * w * .04), meterHeight * h);
    }
    // A slow light pass reveals the drafting lines; it is not a simulated level meter.
    ctx.save();
    ctx.clip();
    const lightX = x + w * (.5 + Math.sin(time * .18) * .55);
    const light = ctx.createLinearGradient(lightX - w * .15, 0, lightX + w * .15, 0);
    light.addColorStop(0, 'rgba(210,226,230,0)');
    light.addColorStop(.5, 'rgba(210,226,230,.11)');
    light.addColorStop(1, 'rgba(210,226,230,0)');
    ctx.strokeStyle = light;
    ctx.stroke();
    ctx.restore();
  }

  // Decorative brand typography lives on a dedicated foreground canvas so the
  // moving copy can pass behind the solid letters at the midpoint handoff.
  function paintBrand() {
    brandCtx.clearRect(0, 0, width, height);
    const mobile = width <= 700;
    const cx = width * (mobile ? .5 : .73 - progress * .46);
    const cy = mobile ? Math.min(height * .23, 185) : height * .47;
    const float = Math.sin(time * .65) * (mobile ? 3 : 7);
    brandCtx.save();
    brandCtx.translate(cx + pointer.x * 16, cy + float + pointer.y * 10);
    brandCtx.rotate(-.015 + Math.sin(time * .28) * .008 + pointer.x * .028);
    brandCtx.transform(1, pointer.y * .018, -.015 + pointer.x * .045, 1, 0, 0);
    brandCtx.font = '800 180px Arial, sans-serif';
    const word = 'RoleAI';
    const wordWidth = brandCtx.measureText(word).width;
    const scale = Math.min(width * (mobile ? .77 : .405) / (wordWidth + 44), height / 650);
    brandCtx.scale(scale, scale);
    brandCtx.textAlign = 'center';
    brandCtx.textBaseline = 'alphabetic';
    const baseline = 50;
    const depth = 22 + Math.sin(time * .4) * 3;
    // Solid graphite extrusion with a moving edge light; no blur-heavy filters.
    for (let layer = Math.ceil(depth); layer > 0; layer--) {
      const shade = Math.round(22 + (1 - layer / depth) * 40);
      brandCtx.fillStyle = `rgb(${shade},${shade + 5},${shade + 8})`;
      brandCtx.fillText(word, -layer * .7, baseline + layer);
    }
    const light = Math.sin(time * .38) * 55 + pointer.x * 90;
    const metal = brandCtx.createLinearGradient(-wordWidth * .35 + light, -135, wordWidth * .24 + light, 95);
    metal.addColorStop(0, '#596367');
    metal.addColorStop(.26, '#d2d9d9');
    metal.addColorStop(.43, '#f3f5f2');
    metal.addColorStop(.52, '#aeb9bd');
    metal.addColorStop(.7, '#434e53');
    metal.addColorStop(1, '#a7b2b6');
    brandCtx.fillStyle = metal;
    brandCtx.fillText(word, 0, baseline);
    brandCtx.lineWidth = .65;
    brandCtx.strokeStyle = 'rgba(230,240,240,.5)';
    brandCtx.strokeText(word, 0, baseline);
    // Hairline gleam travels across the face slowly, clipped to the glyphs by fillText.
    const sweep = Math.sin(time * .38) * wordWidth * .5 + pointer.x * 100;
    const gleam = brandCtx.createLinearGradient(sweep - 80, 0, sweep + 80, 0);
    gleam.addColorStop(0, 'rgba(255,255,255,0)');
    gleam.addColorStop(.5, 'rgba(255,255,255,.2)');
    gleam.addColorStop(1, 'rgba(255,255,255,0)');
    brandCtx.fillStyle = gleam;
    brandCtx.fillText(word, 0, baseline);
    const signatureSize = Math.max(24, 16 / scale);
    const descriptorSize = Math.max(15, 13 / scale);
    const signature = 'S T U D I O';
    const descriptor = '专业音频工作站';
    brandCtx.font = `400 ${signatureSize}px Arial, sans-serif`;
    const signatureWidth = brandCtx.measureText(signature).width;
    brandCtx.font = `400 ${descriptorSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
    const descriptorWidth = brandCtx.measureText(descriptor).width;
    const signatureGap = Math.max(20, 13 / scale);
    const lockupLeft = -(signatureWidth + signatureGap + descriptorWidth) * .5 + 6;
    brandCtx.textAlign = 'left';
    brandCtx.font = `400 ${signatureSize}px Arial, sans-serif`;
    brandCtx.fillStyle = '#9ba8ac';
    brandCtx.fillText(signature, lockupLeft, 130);
    brandCtx.font = `400 ${descriptorSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
    brandCtx.fillStyle = '#78868a';
    brandCtx.fillText(descriptor, lockupLeft + signatureWidth + signatureGap, 130);
    brandCtx.restore();
  }

  function paint() {
    ctx.clearRect(0, 0, width, height);
    paintFramework();
    paintBrand();
    document.documentElement.classList.add('canvas-ready');
  }

  function updateCopy() {
    const nextAlternate = progress >= handoffProgress;
    if (nextAlternate !== alternateCopy) {
      alternateCopy = nextAlternate;
      const state = alternateCopy ? copy.landed : copy.opening;
      heroEyebrow.textContent = state.eyebrow;
      heroTitle.innerHTML = state.title;
      heroIntro.textContent = state.intro;
    }
    const travelOpacity = 1 - Math.sin(progress * Math.PI) * .7;
    const handoffWindow = .09;
    const handoffOpacity = nextAlternate
      ? clamp((progress - handoffProgress) / handoffWindow)
      : clamp((handoffProgress - progress) / handoffWindow);
    hero.style.opacity = String(width <= 700 ? 1 : travelOpacity * handoffOpacity);
    hero.style.translate = `${width <= 700 ? 0 : progress * copyTravel}px 0`;
    hero.inert = false;
    hero.setAttribute('aria-hidden', 'false');
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    // Seed the clock before the FPS gate; otherwise every initial delta is zero.
    if (!last) last = now - 34;
    const delta = Math.min(50, now - last);
    if (delta < 30 && !paused) { schedule(); return; }
    last = now;
    if (!paused) {
      time += delta / 1000;
      pointer.x += (pointer.targetX - pointer.x) * .14;
      pointer.y += (pointer.targetY - pointer.y) * .14;
    }
    paint(); updateCopy();
    if (!paused) schedule();
  }
  function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }
  function reflectMotion() {
    document.documentElement.classList.toggle('motion-paused', paused);
    document.dispatchEvent(new CustomEvent('roleai-motion', {detail: {paused}}));
  }
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || paused || media.matches || width <= 700) return;
    const rect = canvas.getBoundingClientRect();
    pointer.targetX = clamp((event.clientX - rect.left) / width * 2 - 1, -1, 1);
    pointer.targetY = clamp((event.clientY - rect.top) / height * 2 - 1, -1, 1);
    schedule();
  }, {passive:true});
  function releasePointer() { pointer.targetX = pointer.targetY = 0; }
  stage.addEventListener('pointerleave', releasePointer, {passive:true});
  stage.addEventListener('pointercancel', releasePointer, {passive:true});
  addEventListener('blur', releasePointer);
  addEventListener('scroll', syncScroll, { passive: true });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { last = 0; schedule(); });
  media.addEventListener('change', () => { paused = media.matches; reflectMotion(); resize(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0 }).observe(canvas);
  reflectMotion(); resize(); updateCopy();
})();

(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let tickId = 0, previous = 0, elapsed = 0;
  const panels = [...document.querySelectorAll('[data-motion]')].map(section => {
    const canvas = section.querySelector('canvas');
    return {section, canvas, context:canvas.getContext('2d'), visible:false, width:0, height:0};
  }).filter(panel => panel.context);
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('revealed'); revealObserver.unobserve(entry.target);
    }
  }, {threshold:.08});
  for (const element of document.querySelectorAll('.section-heading,.mcp-layout,.voice-layout,.audio-tools-grid,.official-plugins-grid,.plugin-row,.start-grid,.lifetime,.workflow')) {
    element.classList.add('reveal-ready'); revealObserver.observe(element);
  }
  function size() {
    for (const panel of panels) {
      const box = panel.section.getBoundingClientRect();
      panel.width=box.width; panel.height=box.height;
      const ratio=Math.min(devicePixelRatio||1,1.25);
      panel.canvas.width=Math.round(box.width*ratio);panel.canvas.height=Math.round(box.height*ratio);
      panel.context.setTransform(ratio,0,0,ratio,0,0);
      draw(panel);
    }
    schedule();
  }
  function draw(panel) {
    const {context:c,width:w,height:h,section}=panel;
    const kind=section.dataset.motion;
    c.clearRect(0,0,w,h);
    c.lineWidth=.7;
    const steps=w<700?60:100;
    const rows=kind==='waves'?25:18;
    for(let row=0;row<rows;row++) {
      c.beginPath();
      c.strokeStyle=`rgba(184,205,211,${.045+.095*Math.pow(Math.sin(row/rows*Math.PI),2)})`;
      for(let point=0;point<=steps;point++) {
        const u=point/steps;
        let x,y;
        if(kind==='connections') {
          x=u*w;
          y=h*.65+Math.sin(u*5+elapsed*.22+row*.06)*h*.12+row*9;
        } else if(kind==='orbit') {
          const a=u*Math.PI*2;
          x=w*.78+Math.cos(a+elapsed*.045)*(w*.23+row*8);
          y=h*.17+Math.sin(a)*(90+row*6);
        } else if(kind==='stems') {
          x=u*w;
          y=h*.62+(row-rows/2)*10+Math.sin(u*12+elapsed*.35+row*.6)*Math.sin(u*Math.PI)*24;
        } else if(kind==='notes') {
          x=u*w;
          y=h*.72+Math.round(Math.sin(u*9+elapsed*.15+row*.08)*4)*12+row*4;
        } else if(kind==='voice') {
          x=u*w;
          const envelope=Math.pow(Math.sin(u*Math.PI),3);
          y=h*.68+Math.sin(u*30-elapsed*.7+row*.13)*envelope*(34+row*3)+(row-rows/2)*5;
        } else if(kind==='waves') {
          x=u*w;
          y=h*.48+Math.sin(u*8-elapsed*.3+row*.16)*(40+Math.sin(u*Math.PI)*95)+row*7;
        } else {
          x=u*w;
          y=h*.7+(row-rows/2)*14*Math.pow(Math.abs(u-.72)*2,.65)+Math.sin(u*4+elapsed*.18)*25;
        }
        if(point===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.stroke();
    }
    if(kind==='connections') {
      for(let dot=0;dot<6;dot++) {
        const u=(elapsed*.026+dot/6)%1;
        const y=h*.65+Math.sin(u*5+elapsed*.22+dot*.12)*h*.12+dot*18;
        c.beginPath();c.arc(u*w,y,2,0,Math.PI*2);c.fillStyle='rgba(211,226,227,.55)';c.fill();
      }
    }
  }
  function animate(now) {
    tickId=0;
    if(document.hidden)return;
    if(now-previous<40){schedule();return;}
    const delta=Math.min(70,now-(previous||now)); previous=now;
    if(!paused)elapsed+=delta/1000;
    for(const panel of panels)if(panel.visible)draw(panel);
    if(!paused)schedule();
  }
  function schedule(){if(!tickId&&!document.hidden&&panels.some(panel=>panel.visible))tickId=requestAnimationFrame(animate);}
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const panel=panels.find(item=>item.section===entry.target);panel.visible=entry.isIntersecting;}
    schedule();
  });
  panels.forEach(panel=>observer.observe(panel.section));
  new ResizeObserver(size).observe(document.body);
  let cameraPending=false;
  function camera(){
    cameraPending=false;
    const frame=document.querySelector('.workspace-frame');
    if(paused||reduced.matches){frame.style.removeProperty('--camera-angle');frame.style.removeProperty('--camera-y');return;}
    const rect=frame.getBoundingClientRect();
    if(rect.bottom<0||rect.top>innerHeight)return;
    const phase=Math.max(-1,Math.min(1,(rect.top-innerHeight*.22)/innerHeight));
    frame.style.setProperty('--camera-angle',`${phase*3}deg`);
    frame.style.setProperty('--camera-y',`${phase*16}px`);
  }
  addEventListener('scroll',()=>{if(!cameraPending){cameraPending=true;requestAnimationFrame(camera);}},{passive:true});
  document.addEventListener('roleai-motion',event=>{paused=event.detail.paused;previous=0;camera();schedule();});
  document.addEventListener('visibilitychange',()=>{previous=0;schedule();});
  size();
})();
