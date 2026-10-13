/* HITL.CC v2 — SIGNAL INTERCEPT
   The page is a compromised SIGINT terminal. The entire world is
   rendered as phosphor glyphs in WebGL:

   PASS 1 · SCENE (cell-res buffer) — raymarched entity: a rotating
     icosahedral mass growing corruption spikes, pressing against the
     authorization boundary; RF waterfall strip; heartbeat trace.
     Outputs per-cell: r=luminance g=threat.
   PASS 2 · STAMP — one glyph per cell from a runtime atlas (density
     ramp + corrupted scramble set), bone→amber tint, threat→red,
     max-blend phosphor persistence (nothing accumulates).
   PASS 3 · DISPLAY — band tearing, chroma split, rolling band,
     scanlines, grain, and the degauss collapse on every act change.

   CPU owns scroll/keyframes/pointer; the shader owns the world.   */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const $ = id => document.getElementById(id);

  /* ============ A · SCENE ENGINE ============ */
  const LEN = { 's-open': 150, 's-origin': 280, 's-inside': 260, 's-auth': 340, 's-hold': 260, 's-key': 280, 's-cta': 190 };
  const scenes = [...document.querySelectorAll('.scene')].map(el => {
    el.style.height = (LEN[el.id] || 200) + 'vh';
    return { el };
  });

  const KF = {
    'sh-title':        [[0,{o:1,s:1,y:0}],[.55,{o:1,y:0}],[1,{x:-40,y:-60,o:0,s:1.15}]],
    'sh-cue':          [[0,{o:.9}],[.25,{o:0}]],
    'sh-strip1':       [[0,{x:60,y:-21,o:1}],[1,{x:-60,y:-21,o:1}]],
    'sh-strip2':       [[0,{x:-60,y:21,o:1}],[1,{x:60,y:21,o:1}]],
    'sh-origin':       [[0,{x:130,o:0}],[.18,{x:0,o:1,s:1}],[.72,{x:0,o:1}],[.95,{x:-140,o:0}],[1,{x:-140,o:0}]],
    'sh-origin-note':  [[0,{y:110,o:0}],[.4,{y:32,o:0}],[.52,{y:32,o:1}],[.75,{o:1}],[.92,{x:-120,o:0}],[1,{x:-120,o:0}]],
    'sh-see':          [[0,{x:120,o:0}],[.08,{x:120,o:1}],[.24,{x:0,o:1}],[.52,{x:0,o:1,s:1}],[.64,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'sh-clear':        [[0,{x:130,o:0}],[.5,{x:130,o:0}],[.56,{x:130,o:1}],[.7,{x:0,o:1,s:1.06}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'sh-inside-note':  [[0,{y:110,o:0}],[.62,{y:34,o:0}],[.74,{y:34,o:1}],[.88,{o:1}],[1,{x:-120,o:0}]],
    'sh-authkick':     [[0,{y:-38,o:0}],[.08,{y:-38,o:1}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'beat1':           [[0,{x:130,o:0}],[.12,{x:0,o:1}],[.28,{o:1}],[.38,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'beat2':           [[0,{x:130,o:0}],[.38,{x:130,o:0}],[.48,{x:0,o:1}],[.62,{o:1}],[.7,{x:-150,o:0}],[1,{x:-150,o:0}]],
    'beat3':           [[0,{x:130,o:0}],[.7,{x:130,o:0}],[.8,{x:0,o:1}],[.94,{o:1}],[1,{x:-150,o:0}]],
    'sh-hold':         [[0,{x:130,o:0,y:-24}],[.2,{x:0,y:-24,o:1}],[.78,{x:0,o:1}],[1,{x:-140,y:-24,o:0}]],
    'sh-hold-note':    [[0,{y:110,o:0}],[.5,{y:38,o:0}],[.64,{y:38,o:1}],[.85,{o:1}],[1,{x:-120,o:0}]],
    'sh-less':         [[0,{x:120,y:-26,o:1}],[.62,{x:-140,y:-26,o:1}],[1,{x:-150,y:-26,o:0}]],
    'sh-more':         [[0,{x:-120,y:26,o:1}],[.68,{x:140,y:26,o:1}],[1,{x:150,y:26,o:0}]],
    'sh-key':          [[0,{s:.7,o:0}],[.3,{s:.7,o:0,y:6}],[.58,{s:1,o:1,y:0}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'sh-key-note':     [[0,{y:110,o:0}],[.6,{y:32,o:0}],[.72,{y:32,o:1}],[.88,{o:1}],[1,{x:-120,o:0}]],
    'sh-hello':        [[0,{x:130,o:0,y:-10}],[.24,{x:0,o:1,y:-10}],[1,{o:1,y:-10}]],
    'sh-cta-note':     [[0,{y:16,o:0}],[.34,{y:16,o:0}],[.5,{y:16,o:1}],[1,{o:1,y:16}]],
    'sh-ctas':         [[0,{y:30,o:0}],[.44,{y:30,o:0}],[.62,{y:30,o:1}],[1,{o:1,y:30}]],
    'sh-meta':         [[0,{y:42,o:0}],[.55,{y:42,o:0}],[.72,{y:42,o:1}],[1,{o:1,y:42}]],
  };

  const shots = {};
  for (const id in KF) shots[id] = { el: $(id), k: KF[id], dirty: true };
  const sceneShots = scenes.map(s => {
    const list = [];
    for (const id in shots) if (s.el.contains(shots[id].el)) list.push(shots[id]);
    return list;
  });

  /* ---- kinetic type ---- */
  const LETTERS = {
    'sh-origin': { in: [.1, .38], stagger: .006, dy: 70 },
    'sh-clear':  { in: [.55, .75], stagger: .012, dy: 44 },
    'sh-hold':   { in: [.05, .3], stagger: .008, dy: 46 },
    'sh-key':    { in: [.3, .6],  stagger: .011, dy: 60 },
    'sh-hello':  { in: [.05, .3], stagger: .013, dy: 50 },
    'sh-see':    { glitch: true },
  };
  const GRAD = 'linear-gradient(100deg, var(--bone), var(--amber) 55%, var(--red))';
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

  /* ---- HUD clock ---- */
  const hudClock = $('hud-clock');
  if (hudClock) setInterval(() => {
    const d = new Date();
    hudClock.textContent =
      String(d.getUTCHours()).padStart(2, '0') + ':' +
      String(d.getUTCMinutes()).padStart(2, '0') + ':' +
      String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
  }, 1000);

  /* ============ B · GLYPH WORLD (WebGL) ============ */
  const cv = $('stage');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    for (const s of scenes) for (const sh of sceneShots[scenes.indexOf(s)]) {
      sh.el.style.transform = 'none'; sh.el.style.opacity = 1; sh.el.style.position = 'static';
    }
    return;
  }

  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  /* ---- pass 1: the world at cell resolution ----
     r = luminance (glyph density) · g = threat (red channel) */
  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float P, Spike, Spin, Glitch, Threat, Gate, Press, Water, Ekg, Lum, Ex, Ey;
uniform vec2 PTR;
mat2 RA, RB; float SC;

float h1(float n){ return fract(sin(n)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float n3(vec3 p){
  vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
}
float fbm3(vec3 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*n3(p); p*=2.1; a*=.5; } return s; }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

float sdIco(vec3 p){
  float q=(sqrt(5.)-3.)/2.;
  vec3 n1=normalize(vec3(q,1.,0.));
  vec3 n2=normalize(vec3(1.,0.,q));
  vec3 n3=normalize(vec3(0.,q,1.));
  vec3 a=abs(p);
  float d=dot(a,normalize(vec3(1.,1.,1.)));
  d=max(d,dot(a,n1)); d=max(d,dot(a,n2)); d=max(d,dot(a,n3));
  return d-.62;
}
float map(vec3 q){
  vec3 p3=q/SC;
  p3.xz=RA*p3.xz; p3.yz=RB*p3.yz;
  float spikes=fbm3(p3*2.6+vec3(0.,T*.3,0.));
  return (sdIco(p3)-spikes*.34*Spike)*SC;
}
/* the EKG trace — periodic deflection traveling with T */
float ekgOff(float x){
  float u=fract(x*.9 - T*.28);
  float o=0.;
  if(u<.05) o=sin(u/.05*3.14159)*.06;
  else if(u<.08) o=-(u-.05)/.03*.14;
  else if(u<.12) o=-.14+(u-.08)/.04*.9;
  else if(u<.16) o=.76-(u-.12)/.04*.96;
  else if(u<.20) o=-.20+(u-.16)/.04*.20;
  else if(u<.30) o=sin((u-.20)/.1*3.14159)*.10;
  return o;
}
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float lum = .028 + .034*h2(uv*R + floor(T*9.));
  float threat = 0.;

  /* ---- THE ENTITY — a rotating mass of corrupted geometry ---- */
  SC = .5*P*(1.+.05*sin(T*2.3));
  RA = rot(T*Spin + PTR.x*1.1);
  RB = rot(.6 + PTR.y*.8);
  if(P>.01){
    vec2 sp = (uv-vec2(Ex,Ey))*vec2(R.x/R.y,1.)*2.5;
    vec3 ro=vec3(0.,0.,2.5), rd=normalize(vec3(sp,-1.9));
    float td=0.,glow=0.,hit=-1.;
    for(int i=0;i<42;i++){
      float d=map(ro+rd*td);
      glow+=exp(-abs(d)*9.)*.028;
      if(d<.0015){ hit=td; break; }
      td+=d*.85;
      if(td>6.) break;
    }
    if(hit>0.){
      vec3 q=ro+rd*hit;
      vec2 e=vec2(.0018,0.);
      vec3 n=normalize(vec3(
        map(q+e.xyy)-map(q-e.xyy),
        map(q+e.yxy)-map(q-e.yxy),
        map(q+e.yyx)-map(q-e.yyx)));
      float dif=clamp(dot(n,normalize(vec3(.5,.8,.6))),0.,1.);
      float rim=pow(1.-clamp(dot(n,-rd),0.,1.),2.4);
      /* solid glyph surface — most faces land on dense glyphs */
      lum += (dif*.5+.32+rim*.9)*P;
      threat += rim*Threat*.7 + fbm3(n*6.)*Spike*.3*Threat;
    }
    lum += glow*P*1.2;
    threat += glow*Threat*1.1;
  }

  /* ---- THE BOUNDARY — vertical authorization line at x=.62 ---- */
  if(Gate>0.){
    float dl=abs(uv.x-.62);
    lum += Gate*exp(-dl*R.x*.6)*1.6;
    lum += Gate*step(.42,fract(uv.y*R.y/5.))*exp(-dl*R.x*.35)*.45;
    /* the line glows hotter where the entity presses it */
    float pressGlow=exp(-abs(uv.y-Ey)*R.y*.25);
    threat += Gate*Press*exp(-dl*R.x*.5)*pressGlow*.9;
    threat += Gate*Press*exp(-dl*R.x*.4)*.3;
    /* contact: entity surface meeting the line sparks */
    float edge=Ex+.17*P+.13*Press;
    float contact=clamp(1.-abs(edge-.62)*16.,0.,1.)*Press;
    float sput=step(.72,h2(vec2(floor(uv.y*R.y*.9),floor(T*24.))))*exp(-dl*R.x*.85);
    lum += contact*sput*1.3;
    threat += contact*sput*Threat*1.2;
    /* hash marks counting attempts */
    float tick=step(.97,h2(vec2(floor(uv.y*R.y/2.),floor(T*2.))));
    lum += Gate*tick*exp(-dl*R.x*.35)*.5;
  }

  /* ---- heartbeat trace ---- */
  if(Ekg>0.){
    float ey=.30 - ekgOff(uv.x)*Ekg;
    lum += Ekg*exp(-abs(uv.y-ey)*R.y*1.3)*(.5+.5*step(.5,fract(T*.4)));
  }

  /* ---- RF waterfall strip (bottom 12%) ---- */
  float wl=0., wt=0.;
  if(uv.y<.12){
    float spec=h2(vec2(floor(uv.x*R.x),floor(uv.y*R.y-T*15.)));
    wl=smoothstep(.42,1.,spec)*.5*Water*(.75+.25*sin(uv.x*46.+T));
    wt=step(.984,spec)*Water;
  }
  float wf=step(uv.y,.12);
  lum=mix(lum,wl,wf); threat=mix(threat,wt,wf);
  lum += exp(-abs(uv.y-.12)*R.y*.7)*.28*Water;

  /* ---- decrypt band: a row of cells where intent resolves ---- */
  float db=exp(-abs(uv.y-.5)*24.)*Glitch;
  float cell=floor(uv.x*R.x);
  lum += db*step(.93,h2(vec2(cell,floor(T*7.))))*.6;

  /* sanitize: one NaN cell poisons the phosphor buffer forever */
  if(lum!=lum) lum=0.; if(threat!=threat) threat=0.;
  gl_FragColor=vec4(min(lum*Lum,1.),min(threat,1.),wf,1.);
}`;

  /* ---- pass 2: stamp one glyph per cell + phosphor persistence ---- */
  const FS_STAMP = `
precision highp float;
uniform sampler2D SCENE, FB, ATLAS;
uniform vec2 R, C;
uniform float T, Glitch, CellAsp;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  vec2 cell = floor(uv*C);
  vec4 data = texture2D(SCENE,(cell+.5)/C);
  float lum = data.r, thr = data.g;
  vec2 cuv = fract(uv*C);

  /* glyph index: density ramp 0-15, corrupted scramble set 16-31.
     corruption lives in the dark — bright geometry stays legible */
  float idx;
  float scr = h2(cell + floor(T*(9.+Glitch*40.))*7.13);
  if(scr < Glitch*(.03+.26*(1.-lum))) idx = 16.+floor(h2(cell+floor(T*57.))*15.99);
  else idx = floor(clamp(lum,0.,.999)*15.99);

  if(data.b>.5) idx = floor(clamp(lum,0.,.999)*15.99); /* waterfall stays clean */
  vec2 guv = vec2((cuv.x-.5)*CellAsp+.5, cuv.y);
  float ink = 0.;
  if(guv.x>=0. && guv.x<=1.) ink = texture2D(ATLAS,vec2((idx+guv.x)/32.,guv.y)).r;

  vec3 bone=vec3(.96,.9,.76), amber=vec3(1.,.68,.28), red=vec3(1.,.18,.24);
  vec3 tint=mix(bone*.5,amber,clamp(lum*1.5-.12,0.,1.));
  vec3 col=tint*ink;
  col=mix(col,red*ink*1.15,clamp(thr*1.7,0.,1.));
  col+=red*thr*.06;

  /* phosphor persistence — history decays, fresh light overwrites */
  vec2 fuv=(uv-.5)*1.0015+.5;
  vec3 prev=texture2D(FB,fuv).rgb*vec3(.885,.9,.86);
  if(prev.r!=prev.r||prev.g!=prev.g||prev.b!=prev.b) prev=vec3(0.);
  col=max(col,prev);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  /* ---- pass 3: display post ---- */
  const FS_DISPLAY = `
precision highp float;
uniform sampler2D IMG;
uniform vec2 R;
uniform float T, Glitch, Collapse;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy/R;
  float band=floor(uv.y*48.);
  float torn=step(1.-Glitch*.42,h2(vec2(band,floor(T*11.))));
  uv.x+=(h2(vec2(band*1.7,floor(T*23.)))-.5)*.11*torn;
  /* degauss collapse — tube folds to a line, then a dot, then dark */
  uv.y=.5+(uv.y-.5)*(1.-Collapse*.97);
  uv.x=.5+(uv.x-.5)*(1.-max(0.,Collapse-.8)*5.);
  vec2 ca=(uv-.5)*(.0016+Glitch*.008);
  vec3 col;
  col.r=texture2D(IMG,uv+ca).r;
  col.g=texture2D(IMG,uv).g;
  col.b=texture2D(IMG,uv-ca).b;
  col*=1.-.09*sin(uv.y*R.y*3.14159);
  float roll=fract(T*.13);
  col+=vec3(1.,.7,.3)*exp(-pow((uv.y-roll)*9.,2.))*.07;
  col+=(h2(uv*fract(T)*371.)-.5)*.05;
  col*=1.-smoothstep(.82,1.,Collapse);
  col*=smoothstep(1.18,.34,distance(uv,vec2(.5)));
  gl_FragColor=vec4(col,1.);
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
  function makeTex(w, h, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  function makeFB(w, h) {
    const tex = makeTex(w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }

  /* ---- glyph atlas: 16-density ramp + 16 corrupted scramble glyphs ---- */
  const GLYPHS = ' .·:;~=+*x#%@◉▓█'.split('').concat('╳◢◣◤◥▚▞░◖◗◈☰ΞΨΩΔ'.split(''));
  let atlasTex;
  {
    const CW = 24, CH = 30, ac = document.createElement('canvas');
    ac.width = CW * 32; ac.height = CH;
    const ctx = ac.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ac.width, ac.height);
    ctx.fillStyle = '#fff';
    ctx.font = '600 22px "JetBrains Mono",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    GLYPHS.forEach((g, i) => ctx.fillText(g, i * CW + CW / 2, CH / 2 + 1));
    atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  function bindQuad(prog) {
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(prog.p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  let progScene, progStamp, progDisp, tScene, fbA, fbB, cols, rows, W, H, dpr;
  try {
    progScene = program(FS_SCENE);
    progStamp = program(FS_STAMP);
    progDisp = program(FS_DISPLAY);
  } catch (e) {
    console.error('[HITL] shader:', e.message);
    for (const s of scenes) for (const sh of sceneShots[scenes.indexOf(s)]) {
      sh.el.style.transform = 'none'; sh.el.style.opacity = 1; sh.el.style.position = 'static';
    }
    return;
  }

  const CELL_W = 10, CELL_H = 15;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.max(32, Math.round(cv.width / (CELL_W * dpr)));
    rows = Math.max(20, Math.round(cv.height / (CELL_H * dpr)));
    tScene = makeFB(cols, rows);
    fbA = makeFB(cv.width, cv.height);
    fbB = makeFB(cv.width, cv.height);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  /* ---- moods per act ---- */
  const MOODS = [
    { p: .2,  spike: .1,  spin: .5,  glitch: .15, threat: .05, gate: 0,  press: 0,  water: .5, ekg: 0,  lum: 1,   ex: .5,  ey: .5 },
    { p: .9,  spike: .3,  spin: .9,  glitch: .35, threat: .2,  gate: 0,  press: 0,  water: .9, ekg: 0,  lum: 1,   ex: .5,  ey: .48 },
    { p: 1.05, spike: .95, spin: 1.3, glitch: .95, threat: .9,  gate: 0,  press: 0,  water: 1,  ekg: 0,  lum: 1,   ex: .5,  ey: .46 },
    { p: 1.0, spike: .7,  spin: .7,  glitch: .6,  threat: .95, gate: 1,  press: 1,  water: .7, ekg: 0,  lum: 1,   ex: .46, ey: .5 },
    { p: .95, spike: .5,  spin: .5,  glitch: .35, threat: .5,  gate: 1,  press: .7, water: .5, ekg: 0,  lum: 1,   ex: .44, ey: .5 },
    { p: .5,  spike: .15, spin: .4,  glitch: .15, threat: .15, gate: 0,  press: 0,  water: .4, ekg: 1,  lum: 1,   ex: .5,  ey: .48 },
    { p: .35, spike: .1,  spin: .5,  glitch: .1,  threat: .1,  gate: .8, press: .4, water: .4, ekg: .4, lum: 1.1, ex: .5,  ey: .48 },
  ];
  const MK = Object.keys(MOODS[0]);
  let phase = 0;
  function mood() {
    const i = clamp(Math.floor(phase), 0, MOODS.length - 2);
    const f = ease(clamp(phase - i, 0, 1));
    const o = {};
    for (const k of MK) o[k] = lerp(MOODS[i][k], MOODS[i + 1][k], f);
    return o;
  }

  /* ---- pointer ---- */
  let px = 0, py = 0, pxx = 0, pyy = 0;
  addEventListener('pointermove', e => {
    pxx = (e.clientX / W - .5); pyy = (e.clientY / H - .5);
  }, { passive: true });

  let t = 0, scrollVel = 0, lastScroll = scrollY, transit = 0, lastAct = 0;
  addEventListener('scroll', () => {
    scrollVel = clamp(scrollVel + Math.abs(scrollY - lastScroll) * .12, 0, 9);
    lastScroll = scrollY;
  }, { passive: true });

  const bar = $('bar');
  const sceneP = new Array(7).fill(0);
  let fakeY = null;

  function sceneRect(el, i) {
    if (scenes[i].docTop == null) scenes[i].docTop = el.getBoundingClientRect().top + scrollY;
    const sy = fakeY ?? scrollY;
    return { top: scenes[i].docTop - sy, bottom: scenes[i].docTop - sy + el.offsetHeight };
  }

  function draw() {
    t += .016; scrollVel = lerp(scrollVel, 0, .05);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);
    transit *= .93;
    const m = mood();
    m.glitch = clamp(m.glitch + scrollVel * .12, 0, 1.4);

    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      sceneP[i] = clamp(-r.top / (scenes[i].el.offsetHeight - H), 0, 1);
      if (r.top <= 0 && r.bottom > 0) {
        phase = lerp(phase, i + sceneP[i], .14);
        if (Math.floor(phase) !== lastAct) { lastAct = Math.floor(phase); transit = Math.max(transit, .6); }
      }
    }

    /* ---- pass 1: scene → cell buffer ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, tScene.fbo);
    gl.viewport(0, 0, cols, rows);
    bindQuad(progScene);
    const u = progScene.u;
    gl.uniform2f(u.R, cols, rows);
    gl.uniform1f(u.T, t);
    gl.uniform1f(u.P, m.p);
    gl.uniform1f(u.Spike, m.spike);
    gl.uniform1f(u.Spin, m.spin);
    gl.uniform1f(u.Glitch, m.glitch);
    gl.uniform1f(u.Threat, m.threat);
    gl.uniform1f(u.Gate, m.gate);
    gl.uniform1f(u.Press, m.press);
    gl.uniform1f(u.Water, m.water);
    gl.uniform1f(u.Ekg, m.ekg);
    gl.uniform1f(u.Lum, m.lum);
    gl.uniform1f(u.Ex, m.ex);
    gl.uniform1f(u.Ey, m.ey);
    gl.uniform2f(u.PTR, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 2: glyph stamp + phosphor → fbB ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fbo);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progStamp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(progStamp.u.SCENE, 0);
    gl.uniform1i(progStamp.u.FB, 1);
    gl.uniform1i(progStamp.u.ATLAS, 2);
    gl.uniform2f(progStamp.u.R, cv.width, cv.height);
    gl.uniform2f(progStamp.u.C, cols, rows);
    gl.uniform1f(progStamp.u.T, t);
    gl.uniform1f(progStamp.u.Glitch, m.glitch);
    gl.uniform1f(progStamp.u.CellAsp, (cv.width / cols) / (cv.height / rows));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 3: display post → screen ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progDisp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbB.tex);
    gl.uniform1i(progDisp.u.IMG, 0);
    gl.uniform2f(progDisp.u.R, cv.width, cv.height);
    gl.uniform1f(progDisp.u.T, t);
    gl.uniform1f(progDisp.u.Glitch, m.glitch);
    gl.uniform1f(progDisp.u.Collapse, transit);
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
            const g = m.glitch * (0.4 + scrollVel * .15);
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
    draw();
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
