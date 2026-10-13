/* HITL.CC — the ghost engine
   The entire world is procedural and lives in WebGL:

   PASS 1 · SCENE — one fragment shader draws everything: the rail,
     its packets, the gate, the infection veins, and THE GHOST — a
     warped silhouette that materializes in act 2 and watches your
     cursor until the gate exists.
   PASS 2 · FEEDBACK — the frame is folded into a ping-pong buffer with
     phosphor decay + micro-zoom: real light trails, not alpha-clear.
   PASS 3 · DISPLAY — post chain: band tearing, chromatic aberration,
     scanlines, rolling band, grain, flicker, impact flash.

   CPU still owns the simulation — packet positions, queue slots, spark
   physics — and ships them to the shader as uniform arrays each frame.
   Scene typography uses the same keyframe engine as before.        */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const $ = id => document.getElementById(id);

  /* ============ A · SCENE ENGINE ============ */
  const LEN = { 's-open': 150, 's-acting': 280, 's-risk': 260, 's-gate': 340, 's-queue': 260, 's-point': 280, 's-cta': 190 };
  const scenes = [...document.querySelectorAll('.scene')].map(el => {
    el.style.height = (LEN[el.id] || 200) + 'vh';
    return { el };
  });

  const KF = {
    'sh-title':       [[0,{o:1,s:1,y:0}],[.55,{o:1,y:0}],[1,{x:-40,y:-60,o:0,s:1.15}]],
    'sh-cue':         [[0,{o:.9}],[.25,{o:0}]],
    'sh-strip1':      [[0,{x:60,y:-21,o:1}],[1,{x:-60,y:-21,o:1}]],
    'sh-strip2':      [[0,{x:-60,y:21,o:1}],[1,{x:60,y:21,o:1}]],
    'sh-acting':      [[0,{x:130,o:0}],[.18,{x:0,o:1,s:1}],[.72,{x:0,o:1}],[.95,{x:-140,o:0}],[1,{x:-140,o:0}]],
    'sh-acting-note': [[0,{y:110,o:0}],[.4,{y:32,o:0}],[.52,{y:32,o:1}],[.75,{o:1}],[.92,{x:-120,o:0}],[1,{x:-120,o:0}]],
    'sh-liability':   [[0,{x:120,o:0}],[.08,{x:120,o:1}],[.24,{x:0,o:1}],[.52,{x:0,o:1,s:1}],[.64,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'sh-witness':     [[0,{x:130,o:0}],[.5,{x:130,o:0}],[.56,{x:130,o:1}],[.7,{x:0,o:1,s:1.06}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'sh-risk-note':   [[0,{y:110,o:0}],[.62,{y:34,o:0}],[.74,{y:34,o:1}],[.88,{o:1}],[1,{x:-120,o:0}]],
    'sh-gatekick':    [[0,{y:-38,o:0}],[.08,{y:-38,o:1}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'beat1':          [[0,{x:130,o:0}],[.12,{x:0,o:1}],[.28,{o:1}],[.38,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'beat2':          [[0,{x:130,o:0}],[.38,{x:130,o:0}],[.48,{x:0,o:1}],[.62,{o:1}],[.7,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'beat3':          [[0,{x:130,o:0}],[.7,{x:130,o:0}],[.8,{x:0,o:1}],[.94,{o:1}],[1,{x:-150,o:0}]],
    'sh-wait':        [[0,{x:130,o:0,y:-24}],[.2,{x:0,y:-24,o:1}],[.78,{x:0,o:1}],[1,{x:-140,y:-24,o:0}]],
    'sh-queue-note':  [[0,{y:110,o:0}],[.5,{y:38,o:0}],[.64,{y:38,o:1}],[.85,{o:1}],[1,{x:-120,o:0}]],
    'sh-less':        [[0,{x:120,y:-26,o:1}],[.62,{x:-140,y:-26,o:1}],[1,{x:-150,y:-26,o:0}]],
    'sh-more':        [[0,{x:-120,y:26,o:1}],[.68,{x:140,y:26,o:1}],[1,{x:150,y:26,o:0}]],
    'sh-loop':        [[0,{s:.7,o:0}],[.3,{s:.7,o:0,y:6}],[.58,{s:1,o:1,y:0}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'sh-point-note':  [[0,{y:110,o:0}],[.6,{y:32,o:0}],[.72,{y:32,o:1}],[.88,{o:1}],[1,{x:-120,o:0}]],
    'sh-hello':       [[0,{x:130,o:0,y:-10}],[.24,{x:0,o:1,y:-10}],[1,{o:1,y:-10}]],
    'sh-cta-note':    [[0,{y:16,o:0}],[.34,{y:16,o:0}],[.5,{y:16,o:1}],[1,{o:1,y:16}]],
    'sh-ctas':        [[0,{y:30,o:0}],[.44,{y:30,o:0}],[.62,{y:30,o:1}],[1,{o:1,y:30}]],
    'sh-meta':        [[0,{y:42,o:0}],[.55,{y:42,o:0}],[.72,{y:42,o:1}],[1,{o:1,y:42}]],
  };

  const shots = {};
  for (const id in KF) shots[id] = { el: $(id), k: KF[id], dirty: true };
  const sceneShots = scenes.map(s => {
    const list = [];
    for (const id in shots) if (s.el.contains(shots[id].el)) list.push(shots[id]);
    return list;
  });

  /* ---- kinetic type: split flagged shots into chars ---- */
  const LETTERS = {
    'sh-acting':    { in: [.1, .38], stagger: .006, dy: 70 },
    'sh-wait':      { in: [.05, .3], stagger: .008, dy: 46 },
    'sh-loop':      { in: [.3, .6],  stagger: .011, dy: 60 },
    'sh-hello':     { in: [.05, .3], stagger: .013, dy: 50 },
    'sh-witness':   { in: [.55, .75], stagger: .012, dy: 44 },
    'sh-liability': { glitch: true },
  };
  const GRAD = 'linear-gradient(100deg, var(--go), var(--cyan) 60%, var(--warn))';
  const gradChars = [];
  for (const id in LETTERS) {
    const el = shots[id]?.el;
    if (!el) continue;
    const chars = [];
    let ci = 0;
    const split = (node, inEm) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            if (ch.trim() === '') { frag.appendChild(document.createTextNode(ch)); continue; }
            const s = document.createElement('span');
            s.className = 'ch' + (inEm ? ' ch-grad' : ''); s.dataset.i = ci++;
            s.textContent = ch;
            frag.appendChild(s); chars.push(s);
            if (inEm) gradChars.push(s);
          }
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          if (n.tagName === 'EM') n.classList.add('ch-parent');
          split(n, inEm || n.tagName === 'EM');
        }
      });
    };
    split(el, false);
    LETTERS[id].chars = chars;
  }
  function layoutGrad() {
    for (const s of gradChars) {
      const em = s.parentElement;
      s.style.background = GRAD;
      s.style.webkitBackgroundClip = 'text';
      s.style.backgroundClip = 'text';
      s.style.color = 'transparent';
      s.style.backgroundSize = em.offsetWidth + 'px ' + em.offsetHeight + 'px';
      s.style.backgroundPosition = (em.offsetLeft - s.offsetLeft) + 'px ' + (em.offsetTop - s.offsetTop) + 'px';
    }
  }
  layoutGrad();
  addEventListener('resize', layoutGrad, { passive: true });
  document.fonts?.ready.then(layoutGrad);

  function evalKF(k, p) {
    if (p <= k[0][0]) return k[0][1];
    if (p >= k[k.length - 1][0]) return k[k.length - 1][1];
    for (let i = 0; i < k.length - 1; i++) {
      const [p0, a] = k[i], [p1, b] = k[i + 1];
      if (p >= p0 && p <= p1) {
        const t = ease((p - p0) / (p1 - p0 || 1));
        return {
          x: lerp(a.x ?? 0, b.x ?? a.x ?? 0, t),
          y: lerp(a.y ?? 0, b.y ?? a.y ?? 0, t),
          o: lerp(a.o ?? 1, b.o ?? a.o ?? 1, t),
          s: lerp(a.s ?? 1, b.s ?? a.s ?? 1, t),
          r: lerp(a.r ?? 0, b.r ?? a.r ?? 0, t),
        };
      }
    }
    return k[k.length - 1][1];
  }

  /* ============ B · WEBGL WORLD ============ */
  const cv = $('stage');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    // no WebGL — static page, shots stay readable
    for (const s of scenes) for (const sh of sceneShots[scenes.indexOf(s)]) {
      sh.el.style.transform = 'none'; sh.el.style.opacity = 1; sh.el.style.position = 'static';
    }
    return;
  }

  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  /* ---- scene shader: the world in one pass ---- */
  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float Lanes, RailY, Turb, Ekg, Glow, Hue, Glitch, Infect, Presence, Gate, GateX, GateShake, GateAngle;
uniform vec2 PTR;
uniform vec4 PK[64];
uniform int PKN;
uniform vec4 SP[48];
uniform int SPN;
uniform vec4 ST[8];   /* stamp rings: x,y,r,hue */
uniform int STN;

float hash(float n){ return fract(sin(n)*43758.5453); }
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),
             mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.,a=.5;
  for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.13; a*=.5; }
  return v;
}
vec3 hsl(float h){ return clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); }

/* mirrored rail curve */
float ekgOff(float x, float t){
  float period = max(240., R.x*.34)/R.x;
  float u = fract((x - t*.16)/period);
  float o=0.;
  if(u<.06) o=sin(u/.06*3.14159)*8.;
  else if(u<.10) o=-(u-.06)/.04*18.;
  else if(u<.14) o=-18.+(u-.10)/.04*110.;
  else if(u<.18) o=92.-(u-.14)/.04*118.;
  else if(u<.22) o=-26.+(u-.18)/.04*26.;
  else if(u<.32) o=sin((u-.22)/.1*3.14159)*14.;
  return o/R.y;
}
float stepN(float x, float t, float seed){
  float i=floor(x*R.x/24. + t*9. + seed*97.);
  return hash(i)-.5;
}
float railY(float x, float lane){
  float smooth_= sin(x*.006*R.x/300.+T*(1.2+lane*.3))*16.
               + sin(x*.021*R.x/300.-T*2.1+lane)*9.;
  float st = stepN(x,T,lane)*46.;
  float n = mix(smooth_,st,clamp(Turb*.7+Glitch*.3,0.,1.))*Turb/R.y;
  float lanes=max(1.,floor(Lanes+.5));
  float sep=min(70.,R.y*.09)/R.y;
  return RailY + (lane-(lanes-1.)*.5)*sep - n - ekgOff(x,T)*Ekg;
}

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  uv.y = 1.-uv.y;
  vec3 col = vec3(.010,.030,.019);

  /* ambient glow */
  if(Glow>.01){
    float d = distance((uv-vec2(.5,RailY))*vec2(R.x/R.y,1.),vec2(0.));
    float h = mix(.42,.97,Hue*.4);
    col += hsl(h)*exp(-d*d/(Glow*.5))*Glow*.16;
  }

  /* infection veins — ridged fbm creeping from the edges */
  if(Infect>.01){
    vec2 q = uv*vec2(R.x/R.y,1.)*3.2;
    q += fbm(q*1.6+T*.05)*.9;
    float edge = min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
    float mask = smoothstep(.5-Infect*.4,.05,edge);
    float ridged = 1.-abs(2.*fbm(q)-1.);
    float vein = smoothstep(1.-Infect*.06,1.,ridged)*mask*Infect;
    col += vec3(1.,.1,.25)*vein*.5;
    /* vein tips pulse */
    col += vec3(1.,.15,.3)*smoothstep(.995,1.,ridged)*mask*Infect*.5;
  }

  /* the rail — luminous trace + chroma ghosts */
  float lanes=max(1.,floor(Lanes+.5));
  for(float l=0.;l<4.;l++){
    if(l>=lanes) break;
    float ry = railY(uv.x,l);
    float d = abs(uv.y-ry);
    float h = mix(.42,.97,Hue*.5);
    col += hsl(h)*(.0009/(d+.004))*(.10+Glow*.14);
    if(Glitch>.1){
      float off = Glitch*5./R.x;
      col += vec3(0.,.9,1.)*(.0006/(abs(uv.y-railY(uv.x-off,l))+.004))*.5*Glitch;
      col += vec3(1.,.1,.3)*( .0006/(abs(uv.y-railY(uv.x+off,l))+.004))*.5*Glitch;
    }
  }

  /* packets — units of work; corrupt ones crawl as zigzag static */
  for(int i=0;i<64;i++){
    if(i>=PKN) break;
    vec4 p=PK[i];
    float ry = railY(p.x,p.y);
    float w = p.w/R.x;
    float d = distance(uv,vec2(p.x,ry));
    /* head glow */
    col += hsl(p.z)*(.0012/(d+.002))*.8;
    /* dash body */
    float inSeg = step(p.x-w,uv.x)*step(uv.x,p.x);
    float zy = ry + (p.z>.9 && p.z<1.? stepN(p.x,T,p.y*7.)*14./R.y : 0.);
    float dd = abs(uv.y-zy)*inSeg;
    col += hsl(p.z)*(.0008/(dd+.003))*inSeg*.9;
  }

  /* the gate — rotating diamond checkpoint under siege */
  if(Gate>.01){
    vec2 g = uv-vec2(GateX,RailY+GateShake*.01);
    g.x*=R.x/R.y;
    float gs = GateShake*.02;
    g += vec2(sin(T*93.)*gs,cos(T*87.)*gs);
    /* diamond sdf */
    vec2 ag = abs(g);
    float dm = (ag.x+ag.y)/1.4142 - .045 - sin(T*2.4)*.003;
    float ring = smoothstep(.004,.0,abs(dm));
    col += vec3(.2,1.,.6)*ring*Gate;
    /* soft halo of the diamond */
    col += vec3(.1,1.,.55)*exp(-max(dm,0.)*30.)*.25*Gate;
    /* dashed perimeter, rotating */
    float ang = atan(g.y,g.x+.0001);
    float rad = length(g);
    float dashes = step(.5,fract(ang*3.8197+GateAngle));
    float pr = smoothstep(.0035,.0,abs(rad-.075))*dashes;
    col += vec3(.1,1.,.55)*pr*.5*Gate;
    /* heartbeat core */
    float beat = pow(max(0.,sin(T*3.2)),6.);
    col += vec3(.4,1.,.7)*exp(-rad*rad*900.)*(.4+beat)*Gate;
  }

  /* stamp rings — released / incinerated shockwaves */
  for(int i=0;i<8;i++){
    if(i>=STN) break;
    vec4 s=ST[i];
    float d=abs(distance((uv-s.xy)*vec2(R.x/R.y,1.),vec2(0.))-s.z);
    col += hsl(s.w)*smoothstep(.006,.0,d)*.8;
  }

  /* sparks */
  for(int i=0;i<48;i++){
    if(i>=SPN) break;
    vec4 s=SP[i];
    float d=distance((uv-s.xy)*vec2(R.x/R.y,1.),vec2(0.));
    col += hsl(s.z)*exp(-d*d*4000.)*s.w;
  }

  /* THE GHOST — a warped silhouette that watches your cursor */
  if(Presence>.01){
    vec2 gp = uv-vec2(.5+PTR.x*.04,.44+PTR.y*.03);
    gp.x*=R.x/R.y;
    gp.y*=1.35;
    float warp = fbm(uv*vec2(R.x/R.y,1.)*6.+T*.15)*.05;
    float head = length(gp+vec2(warp*.3,warp)) - .11;
    /* dissolve edge with corruption */
    head += (fbm(uv*40.+T*.4)-.5)*.02*(1.-Presence*.5);
    float edge = smoothstep(.006,-.006,head);
    float hollow = smoothstep(-.02,-.10,head);
    /* the void inside, rim-lit */
    col = mix(col, vec3(.004,.012,.008), edge*.85*Presence);
    col += vec3(.9,.15,.3)*smoothstep(.003,-.003,abs(head))*.7*Presence;
    /* eyes — track the pointer */
    vec2 look = normalize(PTR-vec2(.5,.44)+.0001)*.012;
    for(int e=0;e<2;e++){
      vec2 ep = vec2((e==0?-.034:.034)+look.x*.8, -.012+look.y);
      float ed = distance(gp+vec2(warp*.3,warp), ep);
      float blink = step(.05,fract(T*.31+float(e)*.13));
      col += vec3(1.,.2,.35)*exp(-ed*ed*9000.)*blink*Presence*1.6;
      col += vec3(1.,.4,.4)*exp(-ed*ed*600.)*.4*blink*Presence;
    }
  }

  /* hard-sanitize: one NaN pixel would smear forever through feedback */
  if (col.r != col.r) col = vec3(0.);
  gl_FragColor = vec4(clamp(col,0.,4.),1.);
}`;

  /* ---- feedback pass: phosphor persistence ---- */
  const FS_FEEDBACK = `
precision highp float;
uniform sampler2D SCENE, FB;
uniform vec2 R;
uniform float T, Glitch;
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy/R;
  vec3 scene = texture2D(SCENE,uv).rgb;
  /* micro-zoom decay — trails smear outward like phosphor bleed */
  vec2 fuv = (uv-.5)*1.0015+.5;
  vec3 fb = texture2D(FB,fuv).rgb*.905;
  fb += texture2D(FB,fuv+vec2(.0012,0.)).rgb*.02;
  fb += texture2D(FB,fuv-vec2(.0012,0.)).rgb*.02;
  /* red decays faster — infection fades quicker than the machine heals */
  fb *= vec3(.985,1.,.99);
  if(fb.r!=fb.r||fb.g!=fb.g||fb.b!=fb.b) fb=vec3(0.);
  vec3 col = scene + fb*vec3(.96,.99,.97);
  /* ghost-scanline noise baked in so corruption persists into history */
  if(Glitch>.05){
    float b=floor(uv.y*46.);
    float s=(hash2(vec2(b,floor(T*14.)))-.5)*Glitch*.02;
    col += vec3(s*.3,s*.1,s*.4);
  }
  gl_FragColor = vec4(col,1.);
}`;

  /* ---- display pass: the post chain ---- */
  const FS_DISPLAY = `
precision highp float;
uniform sampler2D IMG;
uniform vec2 R;
uniform float T, Glitch, Impact;
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy/R;
  /* band tearing */
  float band = floor(uv.y*42.);
  float torn = step(1.-Glitch*.45,hash2(vec2(band,floor(T*11.))));
  uv.x += (hash2(vec2(band*1.7,floor(T*23.)))-.5)*.09*torn;
  /* rolling scan band */
  float roll = fract(T*.11);
  float rb = exp(-pow((uv.y-roll)*8.,2.))*.12;
  /* chromatic aberration — radial + glitch pulse */
  vec2 ca = (uv-.5)*( .0016 + Glitch*.006 + Impact*.01 );
  vec3 col;
  col.r = texture2D(IMG,uv+ca).r;
  col.g = texture2D(IMG,uv).g;
  col.b = texture2D(IMG,uv-ca).b;
  /* scanlines */
  col *= 1.-.07*sin(uv.y*R.y*3.14159);
  col += vec3(.04,.9,.5)*rb*.25;
  /* impact flash */
  col += vec3(1.,.15,.25)*Impact*.25*exp(-distance(uv,vec2(.5))*3.);
  /* grain + flicker */
  col += (hash2(uv*fract(T)*371.)-.5)*.045;
  col *= .96+.04*sin(T*57.)*min(Glitch,1.);
  col *= 1.22; /* exposure */
  /* vignette */
  col *= smoothstep(1.15,.35,distance(uv,vec2(.5)));
  gl_FragColor = vec4(col,1.);
}`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  const progScene = program(FS_SCENE);
  const progFb = program(FS_FEEDBACK);
  const progDisp = program(FS_DISPLAY);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bindQuad = prog => {
    gl.useProgram(prog.p);
    const loc = gl.getAttribLocation(prog.p, 'p');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo };
  }

  const RENDER_SCALE = .8;
  let W, H, rw, rh, tScene, fbA, fbB;
  function size() {
    W = innerWidth; H = innerHeight;
    cv.width = W; cv.height = H;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    rw = Math.max(2, W * RENDER_SCALE | 0); rh = Math.max(2, H * RENDER_SCALE | 0);
    tScene = makeTarget(rw, rh); fbA = makeTarget(rw, rh); fbB = makeTarget(rw, rh);
  }
  addEventListener('resize', size, { passive: true });
  size();

  /* ============ C · MOODS + SIM ============ */
  const MOODS = [
    { lanes: 1, flow: .9,  sp: 1.1, turb: .08, danger: 0,   gate: 0, queue: 0,   ekg: .4,  glow: 1.2, railY: .5,  hue: 0,   glitch: .18, infect: .12, presence: .4 },
    { lanes: 3, flow: 1.8, sp: 3.4,  turb: .6,  danger: .08, gate: 0, queue: 0,   ekg: 0,   glow: .15, railY: .5,  hue: .2,  glitch: .55, infect: .3,  presence: .55 },
    { lanes: 2, flow: 1,   sp: 2.4,  turb: 1.7, danger: .45, gate: 0, queue: 0,   ekg: 0,   glow: .3,  railY: .5,  hue: .8,  glitch: 1,   infect: .85, presence: 1 },
    { lanes: 1, flow: 1.4, sp: 1.5,  turb: .15, danger: .3,  gate: 1, queue: 1,   ekg: 0,   glow: .35, railY: .62, hue: .2,  glitch: .5,  infect: .4,  presence: .55 },
    { lanes: 1, flow: .9,  sp: .55,  turb: .05, danger: .18, gate: 1, queue: 1.3, ekg: 0,   glow: .25, railY: .68, hue: .1,  glitch: .3,  infect: .2,  presence: .3 },
    { lanes: 1, flow: .35, sp: .8,   turb: .12, danger: 0,   gate: 0, queue: 0,   ekg: 1,   glow: .8,  railY: .5,  hue: 0,   glitch: .1,  infect: .05, presence: 0 },
    { lanes: 1, flow: .3,  sp: 1.1,  turb: .1,  danger: 0,   gate: .8, queue: .6, ekg: .5,  glow: 1.1, railY: .5,  hue: 0,   glitch: .08, infect: .03, presence: .14 },
  ];
  const MOOD_KEYS = Object.keys(MOODS[0]);
  let phase = 0;
  const MOOD = {};
  function mood() {
    const i = clamp(Math.floor(phase), 0, MOODS.length - 2);
    const f = ease(clamp(phase - i, 0, 1));
    const a = MOODS[i], b = MOODS[i + 1];
    for (const k of MOOD_KEYS) MOOD[k] = lerp(a[k], b[k], f);
    return MOOD;
  }

  let pxx = 0, pyy = 0, px = 0, py = 0;
  addEventListener('pointermove', e => {
    pxx = (e.clientX / innerWidth - .5);
    pyy = (e.clientY / innerHeight - .5);
  }, { passive: true });

  /* packets */
  const packets = [];
  let spawnAcc = 0;
  function spawn(m) {
    const danger = Math.random() < m.danger;
    packets.push({
      x: -.05,
      lane: Math.floor(Math.random() * Math.max(1, Math.round(m.lanes))),
      speed: .7 + Math.random() * .6,
      danger,
      hue: danger ? .97 : (Math.random() < .18 ? .11 : .42),
      state: 'run', slot: -1, w: 22 + Math.random() * 30,
    });
  }
  const sparks = [];
  function burst(x, y, hue, n, power) {
    for (let i = 0; i < n && sparks.length < 48; i++) {
      const a = Math.random() * Math.PI * 2, v = (1 + Math.random() * 3) * power;
      sparks.push({ x, y, vx: Math.cos(a) * v / W, vy: Math.sin(a) * v / H, life: 40 + Math.random() * 30, hue });
    }
  }
  const stamps = [];
  let releaseTimer = 0, gateAngle = 0, gateShake = 0, impact = 0;

  const laneY = (l, m) => {
    const n = Math.max(1, Math.round(m.lanes));
    const sep = Math.min(70, H * .09);
    return H * m.railY + py * 30 + (l - (n - 1) / 2) * sep;
  };
  function stepNoise(x, t, seed) {
    const i = Math.floor(x / 24 + t * 9 + seed * 97);
    return ((i * 2654435761) % 1024) / 1024 - .5;
  }

  let t = 0, scrollVel = 0, lastScroll = scrollY;
  addEventListener('scroll', () => {
    scrollVel = clamp(scrollVel + Math.abs(scrollY - lastScroll) * .12, 0, 9);
    lastScroll = scrollY;
  }, { passive: true });

  const bar = $('bar');
  const sceneP = new Array(7).fill(0);
  const sceneOn = new Array(7).fill(false);

  const pkArr = new Float32Array(64 * 4);
  const spArr = new Float32Array(48 * 4);
  const stArr = new Float32Array(8 * 4);
  let fakeY = null;

  function sceneRect(el, i) {
    if (scenes[i].docTop == null) scenes[i].docTop = el.getBoundingClientRect().top + scrollY;
    const sy = fakeY ?? scrollY;
    return { top: scenes[i].docTop - sy, bottom: scenes[i].docTop - sy + el.offsetHeight };
  }

  function draw() {
    t += .016; scrollVel = lerp(scrollVel, 0, .05);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);
    impact *= .9;
    const m = mood();
    m.sp += scrollVel * .5;

    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      sceneP[i] = clamp(-r.top / (scenes[i].el.offsetHeight - H), 0, 1);
      sceneOn[i] = r.top <= H && r.bottom >= 0;
      if (r.top <= 0 && r.bottom > 0) phase = lerp(phase, i + sceneP[i], .14);
    }

    /* ---- sim: packets ---- */
    spawnAcc += m.flow * .06;
    while (spawnAcc > 1 && packets.length < 64) { spawn(m); spawnAcc -= 1; }
    const queueing = m.gate > .5;
    const gx = (W / 2 + px) / W;
    const held = packets.filter(p => p.state === 'held').sort((a, b) => a.x - b.x);
    held.forEach((p, i) => { p.slot = i; });

    releaseTimer -= 1;
    if (queueing && releaseTimer <= 0 && held.length) {
      releaseTimer = 46;
      const front = held[held.length - 1];
      front.state = 'released';
      stamps.push({ x: gx, y: laneY(front.lane, m) / H, r: .02, a: 1, hue: .42 });
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const y0 = laneY(Math.min(p.lane, Math.max(0, Math.round(m.lanes) - 1)), m) / H;
      if (p.state === 'run') {
        p.x += p.speed * m.sp * 2.2 / W * 60;
        if (Math.random() < m.glitch * .02) p.x += (Math.random() - .5) * 36 / W;
        if (queueing && p.danger && p.x >= gx - .06) {
          gateShake = Math.min(gateShake + 1.4, 6); impact = Math.min(impact + .8, 2);
          burst(gx, y0, .97, 14, 2.2);
          stamps.push({ x: gx, y: y0, r: .015, a: 1, hue: .97 });
          packets.splice(i, 1); continue;
        }
        if (queueing && !p.danger && p.x >= gx - .09 - held.length * .03 * m.queue) p.state = 'held';
        if (!queueing && p.danger && p.x > .3 && Math.random() < .004 + m.danger * .012) {
          burst(p.x, y0, .97, 14, 2);
          stamps.push({ x: p.x, y: y0, r: .012, a: .8, hue: .97 });
          impact = Math.min(impact + .5, 1.5);
          packets.splice(i, 1); continue;
        }
      } else if (p.state === 'held') {
        if (!queueing) { p.state = 'released'; continue; }
        const target = gx - .09 - (held.length - 1 - p.slot) * .03 * m.queue;
        p.x = lerp(p.x, Math.min(target, gx - .06), .18);
        p.holdPulse = (p.holdPulse || 0) + .1;
      } else {
        p.x += p.speed * m.sp * 4.5 / W * 60;
      }
      if (p.x > 1.1) packets.splice(i, 1);
    }

    /* sparks */
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (--s.life < 0) { sparks.splice(i, 1); continue; }
      s.vx *= .94; s.vy = s.vy * .94 + .00003;
      s.x += s.vx * 60; s.y += s.vy * 60;
    }
    for (let i = stamps.length - 1; i >= 0; i--) {
      const s = stamps[i];
      s.r += .0025; s.a *= .93;
      if (s.a < .03 || stamps.length > 8) stamps.splice(i, 1);
    }
    gateAngle += .012 + m.turb * .02;
    gateShake *= .88;

    /* ---- pass 1: scene ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, tScene.fbo);
    gl.viewport(0, 0, rw, rh);
    bindQuad(progScene);
    const u = progScene.u;
    gl.uniform2f(u.R, rw, rh);
    gl.uniform1f(u.T, t);
    gl.uniform1f(u.Lanes, m.lanes);
    gl.uniform1f(u.RailY, m.railY + py * 30 / H);
    gl.uniform1f(u.Turb, m.turb);
    gl.uniform1f(u.Ekg, m.ekg);
    gl.uniform1f(u.Glow, m.glow);
    gl.uniform1f(u.Hue, m.hue);
    gl.uniform1f(u.Glitch, m.glitch);
    gl.uniform1f(u.Infect, m.infect);
    gl.uniform1f(u.Presence, m.presence);
    gl.uniform1f(u.Gate, m.gate);
    gl.uniform1f(u.GateX, gx);
    gl.uniform1f(u.GateShake, gateShake);
    gl.uniform1f(u.GateAngle, gateAngle);
    gl.uniform2f(u.PTR, .5 + px, .5 + py);

    let pkn = 0;
    for (const p of packets) {
      if (pkn >= 64) break;
      pkArr[pkn * 4] = p.x;
      pkArr[pkn * 4 + 1] = p.lane;
      pkArr[pkn * 4 + 2] = p.danger ? .97 : p.hue;
      pkArr[pkn * 4 + 3] = p.w * (p.state === 'released' ? 1.6 : 1);
      pkn++;
    }
    gl.uniform4fv(u.PK, pkArr);
    gl.uniform1i(u.PKN, pkn);

    let spn = 0;
    for (const s of sparks) {
      if (spn >= 48) break;
      spArr[spn * 4] = s.x; spArr[spn * 4 + 1] = s.y;
      spArr[spn * 4 + 2] = s.hue; spArr[spn * 4 + 3] = Math.min(1, s.life / 40);
      spn++;
    }
    gl.uniform4fv(u.SP, spArr);
    gl.uniform1i(u.SPN, spn);

    let stn = 0;
    for (const s of stamps) {
      stArr[stn * 4] = s.x; stArr[stn * 4 + 1] = s.y;
      stArr[stn * 4 + 2] = s.r; stArr[stn * 4 + 3] = s.hue;
      if (++stn >= 8) break;
    }
    gl.uniform4fv(u.ST, stArr);
    gl.uniform1i(u.STN, stn);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 2: feedback ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fbo);
    gl.viewport(0, 0, rw, rh);
    bindQuad(progFb);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.uniform1i(progFb.u.SCENE, 0); gl.uniform1i(progFb.u.FB, 1);
    gl.uniform2f(progFb.u.R, rw, rh);
    gl.uniform1f(progFb.u.T, t);
    gl.uniform1f(progFb.u.Glitch, m.glitch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 3: display ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progDisp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbB.tex);
    gl.uniform1i(progDisp.u.IMG, 0);
    gl.uniform2f(progDisp.u.R, cv.width, cv.height);
    gl.uniform1f(progDisp.u.T, t);
    gl.uniform1f(progDisp.u.Glitch, m.glitch);
    gl.uniform1f(progDisp.u.Impact, impact);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const tmp = fbA; fbA = fbB; fbB = tmp;

    /* ---- shots ---- */
    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      const p = sceneP[i];
      const active = r.top <= H && r.bottom >= 0;
      for (const s of sceneShots[i]) {
        if (!active && !s.dirty) continue;
        const v = evalKF(s.k, p);
        const ySpread = W < 700 && s.el.classList.contains('strip') ? 1.6 : 1;
        const x = (v.x ?? 0) * W / 100, y = (v.y ?? 0) * H / 100 * ySpread;
        s.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(v.s ?? 1).toFixed(3)}) rotate(${(v.r ?? 0).toFixed(1)}deg)`;
        s.el.style.opacity = (v.o ?? 1).toFixed(3);
        s.dirty = active;

        const lf = LETTERS[s.el.id];
        if (lf?.chars) {
          if (lf.in) {
            const [i0, i1] = lf.in;
            for (const c of lf.chars) {
              const cp = clamp((p - i0 - (+c.dataset.i) * lf.stagger) / ((i1 - i0) * .55), 0, 1);
              const ce = ease(cp);
              c.style.transform = `translateY(${((1 - ce) * lf.dy).toFixed(1)}px)`;
              c.style.opacity = ce.toFixed(2);
            }
          }
          if (lf.glitch && active) {
            const g = m.turb * (0.4 + scrollVel * .15);
            for (const c of lf.chars) {
              if (Math.random() < .3) {
                c.style.transform = `translate(${(Math.random() - .5) * g * 6}px,${(Math.random() - .5) * g * 6}px)`;
                c.style.opacity = Math.random() < .08 * g ? .3 : 1;
              }
            }
          }
        }
      }
    }

    bar.style.width = ((fakeY ?? scrollY) / (document.documentElement.scrollHeight - H) * 100).toFixed(2) + '%';

    if (!reduced) requestAnimationFrame(draw);
  }

  if (reduced) {
    for (let i = 0; i < scenes.length; i++) {
      for (const s of sceneShots[i]) {
        s.el.style.transform = 'none'; s.el.style.opacity = 1;
        s.el.style.position = 'static';
      }
    }
    draw(); // one frame so the world still renders
  } else {
    // #p=<0..1> fakes scroll depth — drives phase/sceneP analytically for headless captures
    const pm = location.hash.match(/p=([\d.]+)/);
    if (pm) {
      const sy = () => (document.documentElement.scrollHeight - innerHeight) * clamp(+pm[1], 0, 1);
      fakeY = sy();
      setTimeout(() => { fakeY = sy(); }, 500);
    }
    requestAnimationFrame(draw);
  }
})();
