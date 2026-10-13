/* HITL.CC v4 — THE SEA
   The page is a sonar terminal watching open water. The entire world
   is rendered as phosphor glyphs in WebGL:

   PASS 1 · SCENE (cell-res buffer) — raymarched ocean: swell trains
     rolling at the camera, a barreling lip that throws a tube around
     the viewer, storm turbulence, a breakwall (your authorization),
     laminar flow on the calm side, heartbeat ripples on still water.
     Outputs per-cell: r=luminance g=threat.
   PASS 2 · STAMP — one glyph per cell from a runtime atlas (density
     ramp + corrupted scramble set), deep-teal→foam tint, threat→red,
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
    'sh-hold':         [[0,{x:130,o:0,y:-8}],[.2,{x:0,y:-8,o:1}],[.78,{x:0,o:1}],[1,{x:-140,y:-8,o:0}]],
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

  /* ---- pass 1: the sea at cell resolution ----
     r = luminance (glyph density) · g = threat (red channel) */
  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float P, Spike, Spin, Glitch, Threat, Gate, Press, Ekg, Lum, Ex, Ey, Face, Steps;
uniform vec2 PTR;
/* BZ lip z · BR lip radius · LCY lip height · BX lateral drift · WZ wall z */
float BZ,BR,LCY,BX,WZ;

float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float n2(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);
}
float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.13; a*=.5; } return s; }

/* ---- the sea surface ---- */
float seaH(vec2 p){
  float t=T*Spin;
  /* long swell trains rolling at the camera */
  float h = pow(.5+.5*sin(p.y*.5 - t*2.0 + sin(p.x*.17)*.9), 3.)*1.1;
  /* crossing swell */
  h += pow(.5+.5*sin(p.y*.95 - t*1.35 + p.x*.45), 4.)*.3;
  /* wind chop — this is the turbulence */
  h += fbm2(p*vec2(.6,1.5) + vec2(0., -t*2.2)) * (.06+Spike*.85);
  h += fbm2(p*3.1 + vec2(-t*.7, -t*1.4)) * Spike * .22;
  /* heartbeat rings — still water answering your pulse */
  float r=length(p-vec2(0.,6.2));
  h += sin(r*6.5 - T*4.)*exp(-r*.4)*.11*Ekg;
  /* the wall calms the water behind it */
  h *= mix(1., .25, smoothstep(WZ-.4, WZ+1.4, p.y)*Gate);
  return h*P;
}

/* ---- the barrel — a tube thrown toward the camera ---- */
float lipD(vec3 q){
  vec2 lp = vec2(q.z-BZ, q.y-LCY);
  float lip = abs(length(lp)-BR)-.07 + pow(abs(q.x-BX)/9.,4.)*1.5;
  /* open the arc toward the viewer — a C-section, not a ring */
  return max(lip, lp.x - BR*.35);
}
/* ---- the wall — a solid line it cannot cross ---- */
float wallD(vec3 q){
  return max(abs(q.z-WZ)-.045, max(abs(q.x)-9., q.y-1.9));
}
float map(vec3 q){
  float d = q.y - seaH(q.xz);
  if(Face>.02) d = min(d, lipD(q));
  if(Gate>.02) d = min(d, wallD(q));
  return d;
}
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float lum = .02 + .03*h2(uv*R + floor(T*9.));
  float threat = 0.;

  BZ = mix(-26., 7.4, Face);   /* the barrel closes distance as Face rises */
  BR = mix(.6, 2.55, Face);
  LCY = .4 + BR*.5;
  BX = Ex*4.;
  WZ = 3.4;

  /* ---- camera rides the surface, looking out to sea ---- */
  vec2 sp = (uv-vec2(.5,Ey))*vec2(R.x/R.y*.667,1.)*2.9;
  vec3 ro = vec3(PTR.x*1.5, 1.15+sin(T*.5)*.05, 9.5);
  vec3 rd = normalize(vec3(sp.x-PTR.x*1.2, sp.y-PTR.y*.8, -2.3));
  float td=0., hit=-1.;
  for(int i=0;i<48;i++){
    if(float(i)>Steps) break;
    float d=map(ro+rd*td);
    if(d<.003){ hit=max(td,.01); break; }
    td+=d*.7;
    if(td>44.) break;
  }
  if(hit>0.){
    vec3 q=ro+rd*hit;
    vec2 e=vec2(.004,0.);
    vec3 n=normalize(vec3(
      map(q+e.xyy)-map(q-e.xyy),
      map(q+e.yxy)-map(q-e.yxy),
      map(q+e.yyx)-map(q-e.yyx)));
    float dif=clamp(dot(n,normalize(vec3(-.45,.75,.4))),0.,1.);
    float dwl = Gate>.02 ? wallD(q) : 9e3;
    float dlp = Face>.02 ? lipD(q) : 9e3;
    float ds  = q.y-seaH(q.xz);
    if(dwl<ds && dwl<dlp){
      /* THE WALL — glyph concrete, seam lights, running pylons */
      lum += (.38+.3*h2(floor(q.xy*5.)+floor(q.z*3.)))*Gate;
      lum += step(.82,fract(q.x*.9))*.3*Gate;             /* pylon seams */
      lum += step(.94,fract(q.y*3.+T*.5))*.35*Gate*Press; /* warning strobes */
      threat += Press*step(.85,h3(q*9.+floor(T*6.)))*.7;
    } else if(dlp<ds){
      /* THE LIP — thrown whitewater; darker inside the tube */
      float fm=.5+fbm2(q.xy*6.+vec2(T*3.,0.))*.7;
      lum += fm*(.4+.6*Face);
      /* the throwing edge burns brightest */
      vec2 lp=vec2(q.z-BZ,q.y-LCY);
      lum += smoothstep(.2,.0,abs(length(lp)-BR))*step(.1,lp.y)*Face*1.3;
      threat += (.1+Threat*.5)*Face;
      if(dot(n,-rd)<0.){ lum*=.25; lum+=Face*.22; } /* interior — the green room glow */
    } else {
      /* THE SEA */
      float steep=clamp(1.-n.y,0.,1.);
      float crest=smoothstep(.3,.95,q.y/max(P,.2));
      float foam=clamp(steep*1.6+crest*.9-.8+Spike*.5,0.,1.);
      foam*=.3+.7*fbm2(q.xz*vec2(4.,1.3)+vec2(0.,-T*2.6));
      lum += .07+dif*.28+crest*.45+foam*.85;
      threat += foam*Threat*.45;
      /* whitewater piling where the sea meets the wall */
      lum += Press*exp(-abs(q.z-WZ)*1.6)*clamp(q.y*.7,0.,1.)*.6;
      threat += Press*exp(-abs(q.z-WZ)*1.2)*.5;
      /* cleared water — signed flow passes through the line, glass-calm */
      float lam=Gate*clamp(1.-Spike*2.4,0.,1.)*smoothstep(WZ-.3,WZ+.9,q.z);
      lum += lam*pow(.5+.5*sin(q.x*2.2+q.z*.35-T*2.4*Spin),7.)*.6;
    }
    /* spray — airborne off the lip and the wall */
    float spr=step(.982,h3(q*11.+floor(T*17.)));
    lum += spr*(Face*.35+Press*.7);
    threat += spr*Threat*.5;
    lum *= exp(-hit*.045); /* distance haze */
  } else {
    /* sky — grain, faint stars, drizzle streaks */
    lum += smoothstep(Ey,1.,uv.y)*.05;
    lum += step(.996,h2(uv*R+floor(T*2.)))*.15*(1.-Threat*.5);
    lum += step(.985,h2(vec2(floor(uv.x*R.x*1.4),floor(uv.y*R.y*2.+T*18.))))*.09;
  }
  /* the horizon never ends */
  lum += exp(-abs(uv.y-Ey)*R.y*.3)*.1;

  /* ---- decrypt band: a row of cells where intent resolves ---- */
  float db=exp(-abs(uv.y-.5)*24.)*Glitch;
  float cell=floor(uv.x*R.x);
  lum += db*step(.93,h2(vec2(cell,floor(T*7.))))*.6;

  /* sanitize: one NaN cell poisons the phosphor buffer forever */
  if(lum!=lum) lum=0.; if(threat!=threat) threat=0.;
  gl_FragColor=vec4(min(lum*Lum,1.),min(threat,1.),0.,1.);
}`;

  /* ---- pass 2: stamp one glyph per cell + phosphor persistence ---- */
  const FS_STAMP = `
precision highp float;
uniform sampler2D SCENE, FB, ATLAS, WORDS;
uniform vec2 R, C;
uniform float T, Glitch, CellAsp, WordOn;
uniform vec3 Decay;
uniform vec4 WRect;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  vec2 cell = floor(uv*C);
  vec4 data = texture2D(SCENE,(cell+.5)/C);
  float lum = data.r, thr = data.g;
  vec2 cuv = fract(uv*C);

  /* glyph index: clean density ramp everywhere — scramble now lives
     only in the post pass (tearing/chroma), the field stays detailed */
  float idx = floor(clamp(lum,0.,.999)*15.99);
  float scr = h2(cell + floor(T*(9.+Glitch*40.))*7.13);

  vec2 guv = vec2((cuv.x-.5)*CellAsp+.5, cuv.y);
  float ink = 0.;
  if(guv.x>=0. && guv.x<=1.) ink = texture2D(ATLAS,vec2((idx+guv.x)/32.,guv.y)).r;

  vec3 deep=vec3(.12,.45,.4), foamc=vec3(.82,1.,.93), red=vec3(1.,.18,.24);
  vec3 tint=mix(deep*.55,foamc,clamp(lum*1.5-.12,0.,1.));
  vec3 col=tint*ink;
  col=mix(col,red*ink*1.15,clamp(thr*1.7,0.,1.));
  col+=red*thr*.06;

  /* THE MACHINE SPEAKS — a band of cells resolves into its words */
  if(cell.x>=WRect.x && cell.x<WRect.x+WRect.z && cell.y>=WRect.y && cell.y<WRect.y+WRect.w){
    vec2 wuv=vec2((cell.x-WRect.x+cuv.x)/WRect.z,1.-(cell.y-WRect.y+cuv.y)/WRect.w);
    float wk=texture2D(WORDS,wuv).r;
    if(scr<.09) wk*=h2(cell+floor(T*23.)); /* its voice corrupts at the edges */
    col=mix(col,vec3(1.,.92,.75),wk*WordOn); /* bone — cuts through the red mass */
  }

  /* phosphor persistence — history decays, fresh light overwrites */
  vec2 fuv=(uv-.5)*1.0004+.5;
  vec3 prev=texture2D(FB,fuv).rgb*Decay;
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
  /* CRT barrel curvature */
  vec2 cc=uv-.5;
  uv+=cc*dot(cc,cc)*.055;
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
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) col=vec3(0.);
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

  function texFromCanvas(c) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /* ---- its voice: pre-rendered word masks ---- */
  const WORD_LINES = { 2: 'I CREST.', 4: 'I BREAK AT THE LINE.', 6: 'I WAIT.' };
  const wordTex = {};
  function buildWords() {
    for (const a in WORD_LINES) {
      const str = WORD_LINES[a];
      const c = document.createElement('canvas');
      c.width = 560; c.height = 96;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 560, 96);
      x.fillStyle = '#fff';
      x.font = '800 52px "JetBrains Mono",monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const sp = 40, w0 = (str.length - 1) * sp;
      let sx = 280 - w0 / 2;
      for (const ch of str) { x.fillText(ch, sx, 52); sx += sp; }
      wordTex[a] = texFromCanvas(c);
    }
  }
  buildWords();
  document.fonts?.ready.then(buildWords); /* redraw once the real font lands */

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

  let CELL_W = 10, CELL_H = 15, steps = 48;
  function resize() {
    const small = innerWidth < 700;
    CELL_W = small ? 12 : 10; CELL_H = small ? 18 : 15;
    steps = small ? 32 : 48;
    dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
    W = innerWidth; H = innerHeight;
    document.documentElement.style.setProperty('--vh', (H * .01) + 'px');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.max(32, Math.round(cv.width / (CELL_W * dpr)));
    rows = Math.max(20, Math.round(cv.height / (CELL_H * dpr)));
    tScene = makeFB(cols, rows);
    fbA = makeFB(cv.width, cv.height);
    fbB = makeFB(cv.width, cv.height);
  }
  resize();
  addEventListener('resize', resize, { passive: true });
  visualViewport?.addEventListener('resize', resize, { passive: true });

  /* ---- moods per act ---- */
  /* moods per act — p=swell amplitude · spike=chop · spin=flow speed ·
     glitch=scramble · threat=red · gate=the wall · press=impact spray ·
     ekg=ripple rings · ex=lip drift · ey=horizon · face=barrel curl */
  const MOODS = [
    { p: .6,  spike: .12, spin: .8,  glitch: .12, threat: .05, gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .62, face: .08 },
    { p: .8,  spike: .2,  spin: .95, glitch: .2,  threat: .12, gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .62, face: .3 },
    { p: 1.05, spike: .5, spin: 1.1, glitch: .55, threat: .3,  gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .6,  face: 1 },
    { p: 1.0, spike: .7,  spin: 1.,  glitch: .5,  threat: .8,  gate: 1,  press: 1,   ekg: 0,   lum: 1,   ex: 0, ey: .6,  face: .7 },
    { p: .95, spike: .8,  spin: .9,  glitch: .55, threat: .65, gate: 1,  press: .75, ekg: 0,   lum: 1,   ex: 0, ey: .6,  face: .4 },
    { p: .7,  spike: .12, spin: 1.3, glitch: .2,  threat: .15, gate: 1,  press: .25, ekg: .25, lum: 1,   ex: 0, ey: .6,  face: .12 },
    { p: .35, spike: .05, spin: .6,  glitch: .1,  threat: .05, gate: .7, press: .15, ekg: .8,  lum: 1.1, ex: 0, ey: .6,  face: .08 },
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

  let t = 0, scrollVel = 0, lastScroll = scrollY, transit = 0, lastAct = 0, wordGlow = 0;
  /* #p= capture mode — skips boot/transient states for verification captures */
  const capture = /p=[\d.]/.test(location.hash);
  addEventListener('scroll', () => {
    scrollVel = clamp(scrollVel + Math.abs(scrollY - lastScroll) / H * .35, 0, 9);
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

  let lastNow = performance.now();
  function draw(now) {
    const dt = Math.min(((now || performance.now()) - lastNow) / 1000, .05);
    lastNow = now || performance.now();
    t += dt; scrollVel = lerp(scrollVel, 0, .05);
    /* phosphor decay normalized to wall-clock — same trail length at any fps */
    const df = dt * 60;
    const dr = Math.pow(.885, df), dg = Math.pow(.9, df), db2 = Math.pow(.86, df);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);
    transit *= .93;
    const m = mood();
    m.glitch = clamp(m.glitch + scrollVel * .12 * (W < 700 ? .5 : 1), 0, 1.4);

    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      sceneP[i] = clamp(-r.top / (scenes[i].el.offsetHeight - H), 0, 1);
      if (r.top <= 0 && r.bottom > 0) {
        phase = capture ? i + sceneP[i] : lerp(phase, i + sceneP[i], .14);
        if (!capture && Math.floor(phase) !== lastAct) { lastAct = Math.floor(phase); transit = Math.max(transit, W < 700 ? .3 : .6); }
      }
    }
    /* CRT power-on: the tube strikes a dot, tears to a line, opens the field */
    const bootE = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
    const collapse = capture ? 0 : Math.max(transit, 1 - bootE);

    /* which of its words is on air */
    let wAct = -1;
    for (const a in WORD_LINES) if (sceneP[a] > .18 && sceneP[a] < .92) wAct = +a;
    wordGlow = lerp(wordGlow, wAct >= 0 ? 1 : 0, .09);

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
    gl.uniform1f(u.Ekg, m.ekg);
    gl.uniform1f(u.Lum, m.lum);
    gl.uniform1f(u.Ex, m.ex);
    gl.uniform1f(u.Ey, m.ey);
    gl.uniform1f(u.Face, m.face);
    gl.uniform1f(u.Steps, steps);
    gl.uniform2f(u.PTR, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 2: glyph stamp + phosphor → fbB ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fbo);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progStamp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, wAct >= 0 && wordTex[wAct] ? wordTex[wAct] : atlasTex);
    gl.uniform1i(progStamp.u.SCENE, 0);
    gl.uniform1i(progStamp.u.FB, 1);
    gl.uniform1i(progStamp.u.ATLAS, 2);
    gl.uniform1i(progStamp.u.WORDS, 3);
    gl.uniform2f(progStamp.u.R, cv.width, cv.height);
    gl.uniform2f(progStamp.u.C, cols, rows);
    gl.uniform1f(progStamp.u.T, t);
    gl.uniform3f(progStamp.u.Decay, dr, dg, db2);
    gl.uniform1f(progStamp.u.Glitch, m.glitch);
    gl.uniform1f(progStamp.u.CellAsp, (cv.width / cols) / (cv.height / rows));
    gl.uniform1f(progStamp.u.WordOn, wordGlow * (.72 + .28 * Math.sin(t * 7.3)));
    if (wAct >= 0) {
      const rw = Math.min(cols - 6, Math.ceil(WORD_LINES[wAct].length * 2.6));
      /* band sits across the entity's eyes — it speaks through its own face */
      gl.uniform4f(progStamp.u.WRect, Math.floor((cols - rw) / 2), Math.floor(rows * .5) - 3, rw, 6);
    } else {
      gl.uniform4f(progStamp.u.WRect, 0, 0, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 3: display post → screen ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progDisp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, location.hash.includes('raw') ? tScene.tex : fbB.tex);
    gl.uniform1i(progDisp.u.IMG, 0);
    gl.uniform2f(progDisp.u.R, cv.width, cv.height);
    gl.uniform1f(progDisp.u.T, t);
    gl.uniform1f(progDisp.u.Glitch, m.glitch);
    gl.uniform1f(progDisp.u.Collapse, collapse);
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
      /* sticky stages never trigger without real scroll — pin them so
         off-viewport shots render in captures */
      document.querySelectorAll('.stage').forEach(el => { el.style.cssText = 'position:fixed;inset:0'; });
    }
    requestAnimationFrame(draw);
  }
})();
