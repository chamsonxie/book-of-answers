/* 答案之书 · 3D 交互（Three.js r128） */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  if (typeof THREE === 'undefined') {
    el('fallback').style.display = 'flex';
    return;
  }

  var ANSWERS = (window.ANSWERS && window.ANSWERS.length) ? window.ANSWERS : ['是的。'];

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- 简易 tween ---------- */
  var tweens = [];
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function addTween(dur, onUpdate, onComplete, delay) {
    tweens.push({ t: -(delay || 0), dur: dur, onUpdate: onUpdate, onComplete: onComplete || null });
  }
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
  var canvas = el('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b16);
  scene.fog = new THREE.Fog(0x070b16, 14, 32);

  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  var camBase = new THREE.Vector3(0, 3.6, 7.4);
  camera.position.copy(camBase);
  var camTarget = new THREE.Vector3(0, 0.9, 0);
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
  var burstLight = new THREE.PointLight(0xffd27a, 0, 12);
  burstLight.position.set(0.9, 2.4, 0.2);
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

  /* ---------- 书 ---------- */
  var book = new THREE.Group();
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

  /* 可翻动的书页 */
  var flipPages = [];
  var pageGeo = new THREE.PlaneGeometry(BW - 0.2, BH - 0.2);
  pageGeo.rotateX(-Math.PI / 2);
  for (var pi = 0; pi < 2; pi++) {
    var pg = new THREE.Group();
    pg.position.set(-BW / 2 + 0.02, 0.625 + pi * 0.012, 0);
    var pm = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({ color: 0xf6efdb, roughness: 0.85, side: THREE.DoubleSide }));
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
  book.add(card);

  /* 光晕 */
  var glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0, depthWrite: false });
  var glow = new THREE.Sprite(glowMat);
  glow.scale.set(5, 5, 1);
  glow.position.set(0, 1.5, 0);
  book.add(glow);

  /* ---------- 金色尘埃 ---------- */
  var DUST = 260;
  var dustGeo = new THREE.BufferGeometry();
  var dpos = new Float32Array(DUST * 3), dspd = new Float32Array(DUST);
  for (var di = 0; di < DUST; di++) {
    dpos[di * 3] = rand(-9, 9); dpos[di * 3 + 1] = rand(0, 7); dpos[di * 3 + 2] = rand(-9, 9);
    dspd[di] = rand(0.08, 0.3);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd9b36c, size: 0.055, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

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

  function flash(onDone, delay) {
    addTween(0.9, function (k) {
      burstLight.intensity = 4 * Math.sin(Math.PI * k);
      glowMat.opacity = 0.85 * Math.sin(Math.PI * k);
      var s = 4 + 3 * k; glow.scale.set(s, s, 1);
    }, onDone, delay);
  }

  function openBook() {
    if (state !== 'closed') return;
    state = 'animating';
    el('hint').textContent = '书页正在翻动……';
    var y0 = book.position.y;
    addTween(0.6, function (k) { book.position.y = y0 + 0.35 * k; });
    addTween(0.6, function (k) { book.position.y = y0 + 0.35 * (1 - k); }, null, 0.6);
    var c0 = coverPivot.rotation.z, c1 = 2.95;
    addTween(1.4, function (k) { coverPivot.rotation.z = c0 + (c1 - c0) * k; }, null, 0.35);
    flipPages.forEach(function (pg, idx) {
      var target = 2.9 - idx * 0.18;
      addTween(0.8, function (k) { pg.rotation.z = target * k; }, null, 1.1 + idx * 0.22);
    });
    setCard(drawAnswer());
    flash(null, 1.3);
    addTween(1.0, function (k) {
      cardMat.opacity = k;
      card.position.y = 1.15 + 0.45 * k;
    }, function () {
      state = 'open';
      el('hint').textContent = '这是书给你的答案 · 点击书本或按钮可再抽一次';
      el('again').classList.add('show');
    }, 1.9);
  }

  function redraw() {
    if (state !== 'open') return;
    state = 'animating';
    el('hint').textContent = '重新洗牌……';
    addTween(0.4, function (k) { cardMat.opacity = 1 - k; });
    flipPages.forEach(function (pg, idx) {
      var target = 2.9 - idx * 0.18;
      addTween(0.5, function (k) { pg.rotation.z = target * (1 - k); }, null, idx * 0.1);
      addTween(0.6, function (k) { pg.rotation.z = target * k; }, null, 0.9 + idx * 0.2);
    });
    setCard(drawAnswer());
    flash(null, 1.0);
    addTween(0.9, function (k) { cardMat.opacity = k; }, function () {
      state = 'open';
      el('hint').textContent = '这是书给你的答案 · 点击书本或按钮可再抽一次';
    }, 1.6);
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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
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
      card.position.y = 1.6 + Math.sin(t * 1.4) * 0.06;
    }

    var p = dustGeo.attributes.position.array;
    for (var i = 0; i < DUST; i++) {
      p[i * 3 + 1] += dspd[i] * dt;
      p[i * 3] += Math.sin(t * 0.6 + i) * 0.0015;
      if (p[i * 3 + 1] > 7) p[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    camera.position.x += ((camBase.x + mx * 0.9) - camera.position.x) * 0.04;
    camera.position.y += ((camBase.y - my * 0.5) - camera.position.y) * 0.04;
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
  }
  animate();
})();
