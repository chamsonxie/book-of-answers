/* 答案之书 · 3D 仪式交互（Three.js r128） */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  if (typeof THREE === 'undefined') {
    el('fallback').style.display = 'flex';
    return;
  }

  var ANSWERS = (window.ANSWERS && window.ANSWERS.length) ? window.ANSWERS : ['是的。'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function setHint(t) { el('hint').textContent = t; }

  /* ---------- 简易 tween ---------- */
  var tweens = [];
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function addTween(dur, onUpdate, onComplete, delay) {
    tweens.push({ t: -(delay || 0), dur: dur, onUpdate: onUpdate, onComplete: onComplete || null });
  }
  function at(delay, fn) { addTween(0.01, function () {}, fn, delay); }
  function stepTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      var k = Math.min(tw.t / tw.dur, 1);
      tw.onUpdate(easeInOut(k));
      if (k >= 1) { tweens.splice(i, 1); if (tw.onComplete) tw.onComplete(); }
    }
  }

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  var dimEl = el('dim'), flashEl = el('flash');
  var canvas = el('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b16);
  scene.fog = new THREE.Fog(0x070b16, 16, 42);

  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  var camFar = new THREE.Vector3();
  var camNear = new THREE.Vector3();
  var camTmp = new THREE.Vector3();
  var dolly = 0;
  var camTarget = new THREE.Vector3(0, 1.1, 0);
  function layoutCamera() {
    var aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    if (aspect < 1) {
      // 竖屏：加大视场角并拉远镜头，保证整本书（含翻开的封面）入画
      camera.fov = 58;
      var s = Math.min(1.35 / aspect, 2.1);
      camFar.set(0, 3.6 * s, 7.4 * s);
      camNear.set(0, 2.7 * s, 5.6 * s);
      camTarget.set(0, 1.25, 0);
    } else {
      camera.fov = 45;
      camFar.set(0, 3.6, 7.4);
      camNear.set(0, 2.7, 5.6);
      camTarget.set(0, 1.1, 0);
    }
    camera.updateProjectionMatrix();
  }
  layoutCamera();
  camera.position.copy(camFar);
  camera.lookAt(camTarget);

  /* ---------- 灯光 ---------- */
  scene.add(new THREE.AmbientLight(0x33415e, 0.55));
  var spot = new THREE.SpotLight(0xffe6b8, 1.35, 40, Math.PI / 5, 0.45, 1);
  spot.position.set(4, 9, 5);
  spot.target.position.set(0, 0.8, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0005;
  scene.add(spot);
  scene.add(spot.target);
  var rim = new THREE.PointLight(0x7a5cff, 0.7, 30);
  rim.position.set(-6, 4, -4);
  scene.add(rim);
  var burstLight = new THREE.PointLight(0xffd27a, 0, 14);
  burstLight.position.set(0.9, 2.6, 0.2);
  scene.add(burstLight);

  /* ---------- 桌面 ---------- */
  var table = new THREE.Mesh(
    new THREE.CircleGeometry(18, 48),
    new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.95, metalness: 0 })
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  /* ---------- canvas 纹理 ---------- */
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toTex(c) {
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  function coverTexture() {
    var c = makeCanvas(512, 700), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 512, 700);
    g.addColorStop(0, '#1c2c52'); g.addColorStop(0.5, '#14213d'); g.addColorStop(1, '#0b1327');
    x.fillStyle = g; x.fillRect(0, 0, 512, 700);
    x.fillStyle = 'rgba(255,255,255,0.45)';
    for (var i = 0; i < 70; i++) x.fillRect(Math.random() * 512, Math.random() * 700, 2, 2);
    x.strokeStyle = '#d4af6a'; x.lineWidth = 6; x.strokeRect(24, 24, 464, 652);
    x.lineWidth = 2; x.strokeRect(40, 40, 432, 620);
    x.fillStyle = '#e8c97a';
    x.beginPath(); x.arc(256, 205, 62, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#14213d';
    x.beginPath(); x.arc(282, 187, 52, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e9cf8f';
    x.font = 'bold 96px "STKaiti","KaiTi","楷体",serif';
    x.textAlign = 'center';
    x.fillText('答案之书', 256, 435);
    x.font = '26px Georgia,serif';
    x.fillStyle = '#b89b5e';
    x.fillText('T H E   B O O K   O F   A N S W E R S', 256, 495);
    x.font = '40px serif'; x.fillStyle = '#d4af6a';
    x.fillText('✦', 256, 585);
    return toTex(c);
  }

  function pageEdgeTexture() {
    var c = makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(120,100,70,0.35)'; x.lineWidth = 1;
    for (var y = 4; y < 256; y += 5) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
    return toTex(c);
  }

  function wrapText(x, text, maxW) {
    var chars = text.split(''), lines = [], line = '';
    for (var i = 0; i < chars.length; i++) {
      var t = line + chars[i];
      if (x.measureText(t).width > maxW && line) { lines.push(line); line = chars[i]; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function answerTexture(text) {
    var c = makeCanvas(640, 420), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, '#f7efdc'); g.addColorStop(1, '#e9dcc0');
    x.fillStyle = g; x.fillRect(0, 0, 640, 420);
    x.strokeStyle = '#8a6f3e'; x.lineWidth = 5; x.strokeRect(18, 18, 604, 384);
    x.lineWidth = 1.5; x.strokeRect(30, 30, 580, 360);
    x.fillStyle = '#8a6f3e'; x.font = '30px serif'; x.textAlign = 'center';
    x.fillText('✦', 320, 80);
    x.fillStyle = '#2c2317';
    x.font = '46px "STKaiti","KaiTi","楷体",serif';
    var lines = wrapText(x, text, 500);
    var lh = 62, startY = 215 - (lines.length - 1) * lh / 2;
    for (var i = 0; i < lines.length; i++) x.fillText(lines[i], 320, startY + i * lh);
    x.fillStyle = '#8a6f3e'; x.font = '30px serif';
    x.fillText('✦', 320, 362);
    return toTex(c);
  }

  function glowTexture() {
    var c = makeCanvas(256, 256), x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,215,140,0.9)');
    g.addColorStop(0.4, 'rgba(255,190,110,0.35)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function beamTexture() {
    var c = makeCanvas(128, 256), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.5, 'rgba(255,225,160,0.55)');
    g.addColorStop(1, 'rgba(255,210,130,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(255,255,255,0.22)';
    for (var i = 0; i < 6; i++) x.fillRect(Math.random() * 128, 0, 4 + Math.random() * 8, 256);
    return new THREE.CanvasTexture(c);
  }

  function circleTexture() {
    var c = makeCanvas(512, 512), x = c.getContext('2d');
    x.strokeStyle = 'rgba(232,201,122,0.9)';
    x.lineWidth = 5;
    x.beginPath(); x.arc(256, 256, 220, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2;
    x.beginPath(); x.arc(256, 256, 190, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(256, 256, 120, 0, Math.PI * 2); x.stroke();
    for (var i = 0; i < 48; i++) {
      var a = i / 48 * Math.PI * 2;
      x.beginPath();
      x.moveTo(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190);
      x.lineTo(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220);
      x.stroke();
    }
    var runes = ['✦', '☽', '✧', '☆', '✶', '☾', '✷', '◈'];
    x.fillStyle = 'rgba(232,201,122,0.95)';
    x.font = '34px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (var j = 0; j < 16; j++) {
      var a2 = j / 16 * Math.PI * 2;
      x.fillText(runes[j % runes.length], 256 + Math.cos(a2) * 155, 256 + Math.sin(a2) * 155);
    }
    return new THREE.CanvasTexture(c);
  }

  /* ---------- 书 ---------- */
  var book = new THREE.Group();
  var REST_Y = 0.85;
  book.position.set(0.9, 0.10, 0.2);
  scene.add(book);

  var BW = 3.4, BH = 4.6;
  var leatherFace = new THREE.MeshStandardMaterial({ map: coverTexture(), roughness: 0.55, metalness: 0.15 });
  var leatherBack = new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.6, metalness: 0.1 });

  function box(w, h, d, mats) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  var bottomCover = box(BW, 0.12, BH, [leatherBack, leatherBack, leatherBack, leatherFace, leatherBack, leatherBack]);
  bottomCover.position.y = 0.06;
  book.add(bottomCover);

  var edgeTex = pageEdgeTexture();
  var pageSide = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
  var pageTop = new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.9 });
  var pages = box(BW - 0.18, 0.5, BH - 0.18, [pageSide, pageSide, pageTop, pageTop, pageSide, pageSide]);
  pages.position.y = 0.12 + 0.25;
  book.add(pages);

  var coverPivot = new THREE.Group();
  coverPivot.position.set(-BW / 2, 0.67, 0);
  book.add(coverPivot);
  var topCover = box(BW, 0.1, BH, [leatherBack, leatherBack, leatherFace, leatherBack, leatherBack, leatherBack]);
  topCover.position.set(BW / 2, 0, 0);
  coverPivot.add(topCover);

  /* 可翻动的书页（翻完后化作光尘消散，不再悬空） */
  var flipPages = [];
  var pageGeo = new THREE.PlaneGeometry(BW - 0.2, BH - 0.2);
  pageGeo.rotateX(-Math.PI / 2);
  for (var pi = 0; pi < 3; pi++) {
    var pg = new THREE.Group();
    pg.position.set(-BW / 2 + 0.02, 0.625 + pi * 0.012, 0);
    var pm = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({
      color: 0xf6efdb, roughness: 0.85, side: THREE.DoubleSide, transparent: true
    }));
    pm.position.set((BW - 0.2) / 2, 0, 0);
    pm.castShadow = true;
    pg.add(pm);
    book.add(pg);
    flipPages.push(pg);
  }

  /* 答案卡片 */
  var cardMat = new THREE.MeshBasicMaterial({ map: answerTexture('心中默念你的问题'), transparent: true, opacity: 0, side: THREE.DoubleSide });
  var card = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.9), cardMat);
  card.position.set(0, 1.6, 0.4);
  card.rotation.x = -0.12;
  card.scale.set(0.6, 0.6, 1);
  book.add(card);

  /* 光晕 */
  var glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0, depthWrite: false });
  var glow = new THREE.Sprite(glowMat);
  glow.scale.set(5, 5, 1);
  glow.position.set(0, 1.5, 0);
  book.add(glow);

  /* 光束 */
  var beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(), transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.85, 5.5, 24, 1, true), beamMat);
  beam.position.set(0.9, 3.4, 0.2);
  scene.add(beam);

  /* 地面法阵 */
  var circleGroup = new THREE.Group();
  circleGroup.position.set(0.9, 0.02, 0.2);
  var circleMat = new THREE.MeshBasicMaterial({
    map: circleTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  var circle = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.65, 64), circleMat);
  circle.rotation.x = -Math.PI / 2;
  circleGroup.add(circle);
  scene.add(circleGroup);

  /* ---------- 金色尘埃 ---------- */
  var DUST = 260;
  var dustGeo = new THREE.BufferGeometry();
  var dpos = new Float32Array(DUST * 3), dspd = new Float32Array(DUST);
  for (var di = 0; di < DUST; di++) {
    dpos[di * 3] = rand(-9, 9); dpos[di * 3 + 1] = rand(0, 7); dpos[di * 3 + 2] = rand(-9, 9);
    dspd[di] = rand(0.08, 0.3);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xd9b36c, size: 0.055, transparent: true, opacity: 0.55, depthWrite: false
  }));
  scene.add(dust);

  /* ---------- 仪式旋涡粒子 ---------- */
  var VORT = 150;
  var vortGeo = new THREE.BufferGeometry();
  var vpos = new Float32Array(VORT * 3);
  var vang = new Float32Array(VORT), vrad = new Float32Array(VORT),
      vh = new Float32Array(VORT), vspd = new Float32Array(VORT);
  for (var vi = 0; vi < VORT; vi++) {
    vang[vi] = rand(0, Math.PI * 2);
    vrad[vi] = rand(1.7, 3.4);
    vh[vi] = rand(0, 3.4);
    vspd[vi] = rand(0.9, 2.1);
  }
  vortGeo.setAttribute('position', new THREE.BufferAttribute(vpos, 3));
  var vortMat = new THREE.PointsMaterial({
    color: 0xffd98a, size: 0.075, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  var vortex = new THREE.Points(vortGeo, vortMat);
  vortex.position.set(0.9, 0, 0.2);
  scene.add(vortex);
  var vortexEnergy = 0;

  /* ---------- 状态机 ---------- */
  var state = 'closed'; // closed | animating | open
  var lastAnswer = -1;
  function drawAnswer() {
    var i;
    do { i = Math.floor(Math.random() * ANSWERS.length); } while (i === lastAnswer && ANSWERS.length > 1);
    lastAnswer = i;
    return ANSWERS[i];
  }
  function setCard(text) {
    if (cardMat.map) cardMat.map.dispose();
    cardMat.map = answerTexture(text);
    cardMat.needsUpdate = true;
  }

  /* 第一幕：点击 → 仪式开始（约 9 秒） */
  function openBook() {
    if (state !== 'closed') return;
    state = 'animating';
    setCard(drawAnswer());
    var y0 = book.position.y, ry0 = book.rotation.y;
    setHint('书听到了你的问题……');

    // 氛围：压暗、法阵亮起、粒子旋涡、镜头推近、书升空转正
    addTween(1.2, function (k) { dimEl.style.opacity = 0.6 * k; });
    addTween(1.6, function (k) { vortexEnergy = k; });
    addTween(1.6, function (k) { circleMat.opacity = 0.8 * k; });
    addTween(1.8, function (k) { book.position.y = y0 + (REST_Y - y0) * k; book.rotation.y = ry0 * (1 - k); });
    addTween(2.5, function (k) { dolly = k; });

    // 第二幕：封面缓缓开启
    at(1.2, function () { setHint('封印正在解开……'); });
    addTween(2.8, function (k) { coverPivot.rotation.z = 3.08 * k; }, null, 1.2);
    addTween(2.8, function (k) { burstLight.intensity = 1.4 * k; glowMat.opacity = 0.4 * k; }, null, 1.2);

    // 第三幕：书页逐张翻动，寻找答案
    at(4.1, function () { setHint('书页正在为你寻找答案……'); });
    flipPages.forEach(function (pg, idx) {
      var d = 4.2 + idx * 0.75;
      addTween(0.9, function (k) { pg.rotation.z = 3.02 * k; }, null, d);
      addTween(0.5, function (k) { burstLight.intensity = 1.4 + 1.2 * Math.sin(Math.PI * k); }, null, d + 0.25);
    });

    // 第四幕：光束冲天，书页化作光尘，答案凝聚
    at(6.7, function () { setHint('答案即将显现 ——'); });
    addTween(0.9, function (k) { beamMat.opacity = 0.9 * k; }, null, 6.7);
    flipPages.forEach(function (pg) {
      addTween(0.7, function (k) { pg.children[0].material.opacity = 1 - k; }, null, 7.0);
    });
    addTween(0.7, function (k) {
      var s = Math.sin(Math.PI * k);
      burstLight.intensity = 1.4 + 5 * s;
      glowMat.opacity = 0.4 + 0.6 * s;
      var gs = 4 + 6 * k; glow.scale.set(gs, gs, 1);
      flashEl.style.opacity = 0.55 * s;
    }, null, 7.0);
    addTween(1.1, function (k) {
      cardMat.opacity = k;
      var s = 0.6 + 0.4 * k; card.scale.set(s, s, 1);
      card.position.y = 1.05 + 0.55 * k;
    }, null, 7.6);

    // 尾声：归于平静
    addTween(1.6, function (k) { beamMat.opacity = 0.9 - 0.65 * k; }, null, 7.9);
    addTween(1.6, function (k) { vortexEnergy = 1 - k; circleMat.opacity = 0.8 - 0.55 * k; }, null, 8.1);
    addTween(1.6, function (k) { dimEl.style.opacity = 0.6 - 0.35 * k; }, null, 8.1);
    at(9.4, function () {
      state = 'open';
      setHint('这是书给你的答案 · 点击书本或按钮可再抽一次');
      el('again').classList.add('show');
      burstLight.intensity = 0.9;
      glowMat.opacity = 0.25;
    });
  }

  /* 再抽一次（约 6.5 秒的精简仪式） */
  function redraw() {
    if (state !== 'open') return;
    state = 'animating';
    el('again').classList.remove('show');
    setHint('书合上了……正在重新聆听你的问题');
    setCard(drawAnswer());

    addTween(0.6, function (k) {
      cardMat.opacity = 1 - k;
      var s = 1 - 0.35 * k; card.scale.set(s, s, 1);
    });
    addTween(1.2, function (k) { dimEl.style.opacity = 0.25 + 0.35 * k; }, null, 0.2);
    addTween(1.2, function (k) { vortexEnergy = k; circleMat.opacity = 0.25 + 0.55 * k; }, null, 0.2);

    // 书页归位
    flipPages.forEach(function (pg, idx) {
      addTween(0.4, function (k) { pg.children[0].material.opacity = k; }, null, 0.4 + idx * 0.1);
      addTween(0.8, function (k) { pg.rotation.z = 3.02 * (1 - k); }, null, 0.9 + idx * 0.12);
    });

    // 再次翻动寻找
    at(2.0, function () { setHint('书页再次为你寻找答案……'); });
    flipPages.forEach(function (pg, idx) {
      var d = 2.1 + idx * 0.55;
      addTween(0.8, function (k) { pg.rotation.z = 3.02 * k; }, null, d);
    });

    // 显现
    at(3.9, function () { setHint('答案即将显现 ——'); });
    addTween(0.8, function (k) { beamMat.opacity = 0.25 + 0.65 * k; }, null, 3.9);
    flipPages.forEach(function (pg) {
      addTween(0.6, function (k) { pg.children[0].material.opacity = 1 - k; }, null, 4.1);
    });
    addTween(0.6, function (k) {
      var s = Math.sin(Math.PI * k);
      burstLight.intensity = 0.9 + 5 * s;
      glowMat.opacity = 0.25 + 0.6 * s;
      var gs = 4 + 6 * k; glow.scale.set(gs, gs, 1);
      flashEl.style.opacity = 0.5 * s;
    }, null, 4.1);
    addTween(1.0, function (k) {
      cardMat.opacity = k;
      var s = 0.6 + 0.4 * k; card.scale.set(s, s, 1);
      card.position.y = 1.05 + 0.55 * k;
    }, null, 4.7);
    addTween(1.4, function (k) {
      beamMat.opacity = 0.9 - 0.65 * k;
      vortexEnergy = 1 - k;
      circleMat.opacity = 0.8 - 0.55 * k;
      dimEl.style.opacity = 0.6 - 0.35 * k;
    }, null, 5.2);
    at(6.6, function () {
      state = 'open';
      setHint('这是书给你的答案 · 点击书本或按钮可再抽一次');
      el('again').classList.add('show');
      burstLight.intensity = 0.9;
      glowMat.opacity = 0.25;
    });
  }

  /* ---------- 交互 ---------- */
  var ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', function (ev) {
    ptr.x = (ev.clientX / window.innerWidth) * 2 - 1;
    ptr.y = -(ev.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(book, true).length) {
      if (state === 'closed') openBook();
      else if (state === 'open') redraw();
    }
  });
  el('again').addEventListener('click', function (ev) { ev.stopPropagation(); redraw(); });

  var mx = 0, my = 0;
  window.addEventListener('pointermove', function (ev) {
    mx = ev.clientX / window.innerWidth - 0.5;
    my = ev.clientY / window.innerHeight - 0.5;
  });

  window.addEventListener('resize', function () {
    layoutCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- 主循环 ---------- */
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    stepTweens(dt);

    if (state === 'closed') {
      book.position.y = 0.10 + Math.sin(t * 1.2) * 0.04;
      book.rotation.y = Math.sin(t * 0.4) * 0.06;
    }
    if (state === 'open') {
      book.position.y = REST_Y + Math.sin(t * 1.1) * 0.05;
      book.rotation.y = Math.sin(t * 0.5) * 0.03;
      card.position.y = 1.6 + Math.sin(t * 1.3) * 0.07;
      card.rotation.y = Math.sin(t * 0.7) * 0.08;
    }

    // 背景尘埃
    var p = dustGeo.attributes.position.array;
    for (var i = 0; i < DUST; i++) {
      p[i * 3 + 1] += dspd[i] * dt;
      p[i * 3] += Math.sin(t * 0.6 + i) * 0.0015;
      if (p[i * 3 + 1] > 7) p[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // 仪式旋涡
    if (vortexEnergy > 0.01) {
      vortMat.opacity = 0.85 * vortexEnergy;
      for (var j = 0; j < VORT; j++) {
        vang[j] += vspd[j] * dt * (0.6 + vortexEnergy);
        var rr = vrad[j] * (1.15 - 0.35 * vortexEnergy);
        vpos[j * 3] = Math.cos(vang[j]) * rr;
        vpos[j * 3 + 1] = vh[j] + Math.sin(t * 2 + j) * 0.15;
        vpos[j * 3 + 2] = Math.sin(vang[j]) * rr;
      }
      vortGeo.attributes.position.needsUpdate = true;
      vortex.rotation.y += dt * 0.5 * vortexEnergy;
      circleGroup.rotation.y += dt * 0.3 * vortexEnergy;
    } else {
      vortMat.opacity = 0;
    }

    if (beamMat.opacity > 0.01) beam.rotation.y += dt * 0.8;

    // 镜头：仪式推近 + 鼠标视差
    camTmp.lerpVectors(camFar, camNear, easeInOut(Math.min(Math.max(dolly, 0), 1)));
    camera.position.x += ((camTmp.x + mx * 0.9) - camera.position.x) * 0.04;
    camera.position.y += ((camTmp.y - my * 0.5) - camera.position.y) * 0.04;
    camera.position.z += (camTmp.z - camera.position.z) * 0.04;
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
  }
  animate();

  // 演示模式：?demo=1 自动开始仪式（用于截图调试）
  if (/(?:\?|&)demo=1/.test(window.location.search)) {
    setTimeout(function () { openBook(); }, 1200);
  }
})();
