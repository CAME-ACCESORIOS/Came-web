// Boutique virtual CAME: un vestíbulo mágico con una puerta por sección.
// Cada puerta lleva a una sala de museo con las joyas colgadas como cuadros.
// Three.js se descarga solo cuando la clienta entra. Usa CATEGORIES, products,
// formatPrice y openLightbox de main.js.
(() => {
    const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

    // Paleta: violeta pastel + dorado
    const C = {
        sky: 0xE9DEF8,
        wall: 0xD9C8F2,
        wainscot: 0xBFA6E6,
        ceiling: 0x8C74BF,
        door: 0x8A66C7,
        doorInset: 0xA98BDD,
        pilaster: 0xEADDFB,
        gold: 0xD4AF6A,
        mat: 0xFAF6FF,
    };

    const EYE = 1.7;
    const OFFSET = 200;              // cada sala vive a 200 unidades de la anterior
    const DOOR_HW = 1.2;             // mitad del ancho de la puerta
    const DOOR_RECT_H = 3.2;         // alto de la parte recta (arriba va el arco)
    const DOOR_GAP = 4;
    const HALL = { halfW: 15, h: 7, zFront: 7, zBack: -7 };
    const HALL_CAM_Z = 4;            // distancia de la cámara a las puertas ≈ 11
    const ROOM = { halfW: 4, h: 5.5 };
    const SPACING = 4.4;
    const PIC_H = 1.7;
    const PIC_MAX_W = 2.2;
    const OPEN_ANGLE = 1.75;

    const $ = id => document.getElementById(id);
    const overlay = $('boutique');
    const enterBtn = $('enterBoutique');
    if (!overlay || !enterBtn) return;

    const hasWebGL = (() => {
        try {
            const c = document.createElement('canvas');
            return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
        } catch (_) { return false; }
    })();
    if (!hasWebGL) { enterBtn.hidden = true; return; }

    const canvas = $('boutiqueCanvas');
    const hint = $('boutiqueHint');
    const fade = $('boutiqueFade');

    let renderer, scene, camera;
    let built = false, raf = 0;
    let mode = 'hall';               // 'hall' | 'room' | 'busy'
    let roomIdx = -1;
    let hoverDoor = -1;
    let travel = 0, travelTarget = 0;
    const sway = { x: 0, y: 0, tx: 0, ty: 0 };
    const hall = { group: null, doors: [], x: 0, tx: 0, minX: 0, maxX: 0, sparkles: null };
    const rooms = [];                // { name, group, offsetX, pictures, products, maxTravel, sparkles }
    const tweens = [];

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Animación guiada por el bucle de render
    function tween(ms, step) {
        return new Promise(resolve => {
            tweens.push({ t0: performance.now(), ms, step, resolve });
        });
    }

    // ---------- Carga de Three.js ----------
    let threePromise = null;
    function loadThree() {
        if (window.THREE) return Promise.resolve();
        if (!threePromise) {
            threePromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = THREE_URL;
                s.onload = resolve;
                s.onerror = () => { threePromise = null; reject(new Error('No se pudo cargar Three.js')); };
                document.head.appendChild(s);
            });
        }
        return threePromise;
    }

    // ---------- Texturas dibujadas ----------
    function canvasTexture(w, h, draw) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        t.anisotropy = 4;
        return t;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function glowTexture(stops) {
        return canvasTexture(128, 128, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            stops.forEach(([o, col]) => g.addColorStop(o, col));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        });
    }

    function checkerTexture(repX, repY) {
        const t = canvasTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#F6F0FC';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#D5C3EE';
            ctx.fillRect(0, 0, w / 2, h / 2);
            ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repX, repY);
        return t;
    }

    function makeSign(title, subtitle, width) {
        const tex = canvasTexture(1440, 360, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(250, 246, 255, 0.95)';
            roundRect(ctx, 8, 8, w - 16, h - 16, 24);
            ctx.fill();
            ctx.strokeStyle = '#D4AF6A';
            ctx.lineWidth = 6;
            roundRect(ctx, 24, 24, w - 48, h - 48, 16);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#5B4585';
            ctx.font = 'italic 400 150px "Cormorant Garamond", serif';
            ctx.fillText(title, w / 2, subtitle ? 200 : 235);
            if (subtitle) {
                ctx.fillStyle = '#8F7FB3';
                ctx.font = '400 36px Montserrat, sans-serif';
                ctx.fillText(subtitle.toUpperCase().split('').join(' '), w / 2, 280);
            }
        });
        return new THREE.Mesh(
            new THREE.PlaneGeometry(width, width / 4),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
    }

    function makePlaque(name, price) {
        const tex = canvasTexture(512, 160, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(250, 246, 255, 0.97)';
            roundRect(ctx, 4, 4, w - 8, h - 8, 14);
            ctx.fill();
            ctx.strokeStyle = '#D4AF6A';
            ctx.lineWidth = 3;
            roundRect(ctx, 10, 10, w - 20, h - 20, 10);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#5B4585';
            ctx.font = 'italic 400 52px "Cormorant Garamond", serif';
            ctx.fillText(name, w / 2, 76);
            ctx.fillStyle = '#8F7FB3';
            ctx.font = '400 28px Montserrat, sans-serif';
            ctx.fillText(price, w / 2, 124);
        });
        return new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 0.4375),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
    }

    // ---------- Materiales y formas ----------
    const std = (color, rough = 0.8, metal = 0, extra = {}) =>
        new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
    const goldMat = () => std(C.gold, 0.3, 0.55, { emissive: 0x6B5320, emissiveIntensity: 0.3 });

    // Puerta de arco: hw = mitad del ancho, hr = alto de la parte recta
    function archShape(hw, hr) {
        const s = new THREE.Shape();
        s.moveTo(-hw, 0);
        s.lineTo(hw, 0);
        s.lineTo(hw, hr);
        s.absarc(0, hr, hw, 0, Math.PI, false);
        s.lineTo(-hw, 0);
        return s;
    }

    // Hoja derecha: la bisagra queda en x = 0 y la hoja ocupa x ∈ [-hw, 0]
    function leafShape(hw, hr) {
        const s = new THREE.Shape();
        s.moveTo(-hw, 0);
        s.lineTo(0, 0);
        s.lineTo(0, hr);
        s.absarc(-hw, hr, hw, 0, Math.PI / 2, false);
        s.lineTo(-hw, 0);
        return s;
    }

    const extrude = (shape, depth) =>
        new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });

    // Estructura de una sala o del vestíbulo: piso, techo, paredes y molduras doradas
    function addShell(g, { halfW, h, zFront, zBack }) {
        const len = zFront - zBack;
        const mid = (zFront + zBack) / 2;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(halfW * 2, len),
            std(0xffffff, 0.25, 0.05, { map: checkerTexture((halfW * 2) / 3, len / 3) })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, mid);
        g.add(floor);

        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, len), std(C.ceiling));
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, h, mid);
        g.add(ceiling);

        [-1, 1].forEach(side => {
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, h), std(C.wall));
            wall.rotation.y = -side * Math.PI / 2;
            wall.position.set(side * halfW, h / 2, mid);
            g.add(wall);

            const wainscot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, len), std(C.wainscot, 0.6));
            wainscot.position.set(side * (halfW - 0.05), 0.55, mid);
            g.add(wainscot);

            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, len), goldMat());
            rail.position.set(side * (halfW - 0.06), 1.12, mid);
            g.add(rail);

            const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, len), goldMat());
            cornice.position.set(side * (halfW - 0.1), h - 0.07, mid);
            g.add(cornice);
        });

        const end = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, h), std(C.wall));
        end.position.set(0, h / 2, zBack);
        g.add(end);

        const wb = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 1.1, 0.1), std(C.wainscot, 0.6));
        wb.position.set(0, 0.55, zBack + 0.05);
        g.add(wb);

        const back = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, h), std(C.wall));
        back.rotation.y = Math.PI;
        back.position.set(0, h / 2, zFront);
        g.add(back);
    }

    function makeSparkles(count, box) {
        const tex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,236,170,0.95)'], [1, 'rgba(255,220,120,0)']]);
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = lerp(box.x0, box.x1, Math.random());
            pos[i * 3 + 1] = lerp(box.y0, box.y1, Math.random());
            pos[i * 3 + 2] = lerp(box.z0, box.z1, Math.random());
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.22, map: tex, transparent: true, depthWrite: false, opacity: 0.9,
        }));
        return pts;
    }

    // ---------- Vestíbulo ----------
    function buildDoor(i, cat, x) {
        const hw = DOOR_HW, hr = DOOR_RECT_H;
        const g = new THREE.Group();
        g.position.set(x, 0, HALL.zBack + 0.02);

        g.add(new THREE.Mesh(extrude(archShape(hw + 0.22, hr), 0.12), goldMat()));

        // luz al otro lado de la puerta
        const portalTex = glowTexture([[0, '#FFFFFF'], [0.55, '#FFF1CF'], [1, '#E9D9FA']]);
        portalTex.repeat.set(1 / (2 * hw), 1 / (hr + hw));
        portalTex.offset.set(0.5, 0);
        const portal = new THREE.Mesh(
            new THREE.ShapeGeometry(archShape(hw, hr), 24),
            new THREE.MeshBasicMaterial({ map: portalTex })
        );
        portal.position.z = 0.13;
        g.add(portal);

        const doorMat = std(C.door, 0.4, 0.1, { side: THREE.DoubleSide });
        const insetMat = std(C.doorInset, 0.35, 0.1, { side: THREE.DoubleSide });
        const leafGeo = extrude(leafShape(hw, hr), 0.1);
        const hits = [];
        const pivots = [];

        [1, -1].forEach(sign => {
            const pivot = new THREE.Group();
            pivot.position.set(sign * hw, 0, 0.14);
            const flip = new THREE.Group();
            flip.scale.x = sign;
            pivot.add(flip);

            const leaf = new THREE.Mesh(leafGeo, doorMat);
            const inset = new THREE.Mesh(leafGeo, insetMat);
            inset.scale.set(0.72, 0.8, 1);
            inset.position.set(-0.16, 0.35, 0.06);
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), goldMat());
            knob.position.set(-0.17, 2.0, 0.22);
            [leaf, inset].forEach(m => { m.userData.doorIndex = i; hits.push(m); });
            flip.add(leaf, inset, knob);
            g.add(pivot);
            pivots.push(pivot);
        });

        const sign = makeSign(cat.name, `${cat.items.length} piezas`, 2.9);
        sign.position.set(0, hr + hw + 0.6, 0.1);
        g.add(sign);

        return { x, group: g, pivots, hits, angle: 0, target: 0 };
    }

    function buildHall() {
        const g = new THREE.Group();
        addShell(g, HALL);

        const n = CATEGORIES.length;
        hall.maxX = ((n - 1) / 2) * DOOR_GAP;
        hall.minX = -hall.maxX;

        CATEGORIES.forEach((cat, i) => {
            const door = buildDoor(i, cat, (i - (n - 1) / 2) * DOOR_GAP);
            g.add(door.group);
            hall.doors.push(door);
        });

        // pilastras entre las puertas
        for (let k = 0; k <= n; k++) {
            const x = (k - n / 2) * DOOR_GAP;
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.4), std(C.pilaster, 0.5));
            col.position.set(x, 3.2, HALL.zBack + 0.2);
            const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.55), goldMat());
            capTop.position.set(x, 6.3, HALL.zBack + 0.25);
            const capBase = capTop.clone();
            capBase.position.y = 0.11;
            g.add(col, capTop, capBase);
        }

        // lámpara de araña
        const chand = new THREE.Group();
        chand.position.set(0, 5.4, -1.5);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.045, 10, 40), goldMat());
        ring.rotation.x = Math.PI / 2;
        chand.add(ring);
        for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFF3D6 }));
            bulb.position.set(Math.cos(a), -0.05, Math.sin(a));
            chand.add(bulb);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFF3D6 }));
        chand.add(core);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, HALL.h - 5.4, 6), goldMat());
        chain.position.y = (HALL.h - 5.4) / 2;
        chand.add(chain);
        g.add(chand);

        hall.sparkles = makeSparkles(160, { x0: -14, x1: 14, y0: 0.4, y1: 6.5, z0: -6.5, z1: 5 });
        g.add(hall.sparkles);

        scene.add(g);
        hall.group = g;
    }

    // ---------- Salas de museo ----------
    function addPiece(room, product, side, z) {
        const g = new THREE.Group();
        g.position.set(side * (ROOM.halfW - 0.1), 1.9, z);
        g.rotation.y = -side * Math.PI / 2;

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), goldMat());
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: C.mat }));
        mat.position.z = 0.055;
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xE9DEF8 }));
        pic.position.z = 0.058;
        pic.userData.productIndex = products.indexOf(product);

        const plaque = makePlaque(product.name, formatPrice(product.price));
        plaque.position.z = 0.03;

        function fit(aspect) {
            let h = PIC_H, w = h * aspect;
            if (w > PIC_MAX_W) { w = PIC_MAX_W; h = w / aspect; }
            pic.scale.set(w, h, 1);
            mat.scale.set(w + 0.2, h + 0.2, 1);
            frame.scale.set(w + 0.42, h + 0.42, 1);
            plaque.position.y = -(h / 2) - 0.62;
        }
        fit(1.5);

        new THREE.TextureLoader().load(product.img, tex => {
            tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            pic.material.map = tex;
            pic.material.color.set(0xffffff);
            pic.material.needsUpdate = true;
            fit(tex.image.width / tex.image.height);
        });

        g.add(frame, mat, pic, plaque);
        room.group.add(g);
        room.pictures.push(pic);

        // charco de luz dorada en el piso, como foco de museo
        const pool = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 3.2),
            new THREE.MeshBasicMaterial({ map: room.poolTex, transparent: true, depthWrite: false })
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(side * (ROOM.halfW - 1.5), 0.02, z);
        room.group.add(pool);
    }

    function buildRoom(cat, idx, poolTex) {
        const list = products.filter(p => p.category === cat.name);
        const rows = Math.ceil(list.length / 2);
        const maxTravel = 4.5 + (rows - 1) * SPACING + 2;
        const zBack = -(maxTravel + 5);

        const group = new THREE.Group();
        group.position.set(OFFSET * (idx + 1), 0, 0);
        group.visible = false;
        addShell(group, { halfW: ROOM.halfW, h: ROOM.h, zFront: 4, zBack });

        const room = { name: cat.name, group, offsetX: group.position.x, pictures: [], products: list, maxTravel, poolTex, sparkles: null };

        list.forEach((p, k) => {
            addPiece(room, p, k % 2 === 0 ? -1 : 1, -(4.5 + Math.floor(k / 2) * SPACING));
        });

        const sign = makeSign(cat.name, `${list.length} piezas`, 3.6);
        sign.position.set(0, 3.3, zBack + 0.05);
        group.add(sign);

        room.sparkles = makeSparkles(110, { x0: -3.5, x1: 3.5, y0: 0.4, y1: ROOM.h - 0.4, z0: zBack + 0.5, z1: 3 });
        group.add(room.sparkles);

        scene.add(group);
        return room;
    }

    async function build() {
        try {
            await Promise.all([
                document.fonts.load('italic 400 100px "Cormorant Garamond"'),
                document.fonts.load('italic 400 52px "Cormorant Garamond"'),
                document.fonts.load('400 30px Montserrat'),
            ]);
        } catch (_) { /* si falla, se usa la tipografía de respaldo */ }

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;

        scene = new THREE.Scene();
        const sky = new THREE.Color(C.sky);
        scene.background = sky;
        scene.fog = new THREE.Fog(sky, 10, 42);

        camera = new THREE.PerspectiveCamera(60, 1, 0.1, 80);
        camera.position.set(0, EYE, 0);
        scene.add(camera);

        scene.add(new THREE.HemisphereLight(0xFFF6EA, 0x9A82C9, 0.95));
        const lamp = new THREE.PointLight(0xFFE6BF, 0.6, 16);
        lamp.position.set(0, 0.6, -1);
        camera.add(lamp);

        const poolTex = glowTexture([[0, 'rgba(255,226,150,0.55)'], [0.6, 'rgba(255,226,150,0.18)'], [1, 'rgba(255,226,150,0)']]);

        buildHall();
        CATEGORIES.forEach((cat, i) => rooms.push(buildRoom(cat, i, poolTex)));
        buildNav();
        built = true;
    }

    // ---------- HUD ----------
    function buildNav() {
        $('boutiqueNav').innerHTML =
            `<button class="boutique-chip" data-go="hall">Vestíbulo</button>` +
            rooms.map((r, i) => `<button class="boutique-chip" data-go="${i}">${r.name}</button>`).join('');
    }

    let hudKey = '';
    function updateHud() {
        const key = `${mode === 'busy' ? 'b' : mode}${roomIdx}`;
        if (key !== hudKey && mode !== 'busy') {
            hudKey = key;
            $('boutiqueRoom').textContent = mode === 'hall' ? 'Elige tu puerta' : rooms[roomIdx].name;
            hint.textContent = mode === 'hall'
                ? 'Desliza para ver las puertas · toca una para entrar'
                : 'Desliza o usa el scroll para recorrer · toca una joya para verla de cerca';
            hint.classList.remove('gone');
            overlay.querySelectorAll('.boutique-chip').forEach(el => {
                const go = el.dataset.go;
                el.classList.toggle('active', mode === 'hall' ? go === 'hall' : go === String(roomIdx));
            });
        }
        let pct = 0;
        if (mode === 'hall') pct = (hall.x - hall.minX) / ((hall.maxX - hall.minX) || 1);
        else if (mode === 'room') pct = travel / rooms[roomIdx].maxTravel;
        $('boutiqueBar').style.width = `${clamp(pct, 0, 1) * 100}%`;
    }

    // ---------- Movimiento ----------
    function pan(delta) {
        if (mode === 'hall') {
            const next = clamp(hall.tx + delta, hall.minX, hall.maxX);
            if (next !== hall.tx) { hall.tx = next; hint.classList.add('gone'); }
        } else if (mode === 'room') {
            const next = clamp(travelTarget + delta, 0, rooms[roomIdx].maxTravel);
            if (next !== travelTarget) { travelTarget = next; hint.classList.add('gone'); }
        }
    }

    function frame() {
        raf = requestAnimationFrame(frame);
        const now = performance.now();
        const t = now * 0.001;

        for (let i = tweens.length - 1; i >= 0; i--) {
            const tw = tweens[i];
            const k = clamp((now - tw.t0) / tw.ms, 0, 1);
            tw.step(k);
            if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
        }

        if (mode === 'hall') {
            hall.x += (hall.tx - hall.x) * 0.08;
            camera.position.set(hall.x + sway.x * 0.3, EYE, HALL_CAM_Z);
        } else if (mode === 'room') {
            travel += (travelTarget - travel) * 0.08;
            camera.position.set(rooms[roomIdx].offsetX + sway.x * 0.3, EYE, -travel);
        }
        sway.x += (sway.tx - sway.x) * 0.05;
        sway.y += (sway.ty - sway.y) * 0.05;
        camera.rotation.y = -sway.x * 0.08;
        camera.rotation.x = -sway.y * 0.04;

        // las hojas de las puertas se abren/cierran suavemente (y se entreabren al pasar el mouse)
        hall.doors.forEach((d, i) => {
            const goal = d.target || (mode === 'hall' && hoverDoor === i ? 0.3 : 0);
            d.angle += (goal - d.angle) * 0.07;
            d.pivots[0].rotation.y = d.angle;
            d.pivots[1].rotation.y = -d.angle;
        });

        // destellos flotando
        const active = mode === 'room' ? rooms[roomIdx].sparkles : hall.sparkles;
        if (active) {
            active.rotation.y = Math.sin(t * 0.15) * 0.05;
            active.position.y = Math.sin(t * 0.6) * 0.12;
            active.material.opacity = 0.7 + 0.25 * Math.sin(t * 2.2);
        }

        renderer.render(scene, camera);
        updateHud();
    }

    function resize() {
        if (!renderer) return;
        const w = overlay.clientWidth, h = overlay.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = camera.aspect < 1 ? 74 : 60;
        camera.updateProjectionMatrix();
    }

    // ---------- Cambios de espacio ----------
    function showSpace(target) {   // 'hall' o índice de sala
        hall.group.visible = target === 'hall';
        rooms.forEach((r, i) => { r.group.visible = target === i; });
        hall.doors.forEach(d => { d.target = 0; d.angle = 0; });
        if (target === 'hall') {
            mode = 'hall';
            const d = hall.doors[roomIdx];
            hall.x = hall.tx = d ? d.x : 0;
            roomIdx = -1;
            camera.position.set(hall.x, EYE, HALL_CAM_Z);
        } else {
            mode = 'room';
            roomIdx = target;
            travel = travelTarget = 0;
            camera.position.set(rooms[target].offsetX, EYE, 0);
        }
        hudKey = '';
    }

    async function switchSpace(target) {   // con destello
        if (mode === 'busy') return;
        mode = 'busy';
        fade.classList.add('on');
        await sleep(550);
        showSpace(target);
        await sleep(80);
        fade.classList.remove('on');
    }

    async function enterRoom(i) {
        if (mode !== 'hall') return;
        mode = 'busy';
        hint.classList.add('gone');
        const d = hall.doors[i];
        d.target = OPEN_ANGLE;
        const x0 = camera.position.x;
        await tween(1300, k => {
            camera.position.x = lerp(x0, d.x, ease(k));
            camera.position.z = lerp(HALL_CAM_Z, -3.6, ease(k));
        });
        fade.classList.add('on');
        await tween(1000, k => {
            camera.position.z = lerp(-3.6, -6.6, ease(k));
        });
        await sleep(150);
        showSpace(i);
        await sleep(80);
        fade.classList.remove('on');
    }

    // ---------- Selección ----------
    function pick(clientX, clientY) {
        if (mode === 'busy') return null;
        const r = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((clientX - r.left) / r.width) * 2 - 1,
            -((clientY - r.top) / r.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        if (mode === 'hall') {
            const hit = ray.intersectObjects(hall.doors.flatMap(d => d.hits))[0];
            return hit ? { door: hit.object.userData.doorIndex } : null;
        }
        const hit = ray.intersectObjects(rooms[roomIdx].pictures)[0];
        return hit ? { piece: hit.object.userData.productIndex } : null;
    }

    // ---------- Abrir / cerrar ----------
    async function open() {
        overlay.hidden = false;
        document.body.classList.add('in-boutique');
        document.body.style.overflow = 'hidden';
        $('boutiqueLoading').hidden = false;
        try {
            await loadThree();
            if (!built) await build();
        } catch (_) {
            close();
            enterBtn.hidden = true;   // sin Three.js queda el catálogo normal
            return;
        }
        if (overlay.hidden) return;
        $('boutiqueLoading').hidden = true;
        fade.classList.remove('on');
        showSpace('hall');
        resize();
        if (!raf) frame();
    }

    function close() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        overlay.hidden = true;
        document.body.classList.remove('in-boutique');
        document.body.style.overflow = '';
    }

    // ---------- Eventos (se registran una vez) ----------
    enterBtn.addEventListener('click', open);
    $('boutiqueClose').addEventListener('click', close);
    $('boutiqueCatalog').addEventListener('click', () => {
        close();
        $('catalog').scrollIntoView({ behavior: 'smooth' });
    });

    $('boutiqueNav').addEventListener('click', e => {
        const chip = e.target.closest('[data-go]');
        if (!chip || mode === 'busy') return;
        const go = chip.dataset.go;
        if (go === 'hall') {
            if (mode === 'room') switchSpace('hall');
        } else if (mode === 'hall') {
            enterRoom(Number(go));
        } else if (Number(go) !== roomIdx) {
            switchSpace(Number(go));
        }
    });

    overlay.addEventListener('wheel', e => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : 1;
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        pan(d * (mode === 'hall' ? 0.01 : 0.012));
    }, { passive: false });

    let drag = null;
    canvas.addEventListener('pointerdown', e => {
        canvas.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 };
    });
    canvas.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse') {
            sway.tx = (e.clientX / window.innerWidth) * 2 - 1;
            sway.ty = (e.clientY / window.innerHeight) * 2 - 1;
            if (!drag && built) {
                const h = pick(e.clientX, e.clientY);
                hoverDoor = h && h.door !== undefined ? h.door : -1;
                canvas.style.cursor = h ? 'pointer' : 'grab';
            }
        }
        if (!drag) return;
        drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
        if (mode === 'hall') pan((drag.lastX - e.clientX) * 0.012);          // arrastrar de lado
        else pan((drag.lastY - e.clientY) * 0.022);                          // arrastrar hacia arriba = avanzar
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', e => {
        if (drag && drag.moved < 6) {
            const h = pick(e.clientX, e.clientY);
            if (h && h.door !== undefined) enterRoom(h.door);
            else if (h && h.piece !== undefined) openLightbox(products[h.piece], rooms[roomIdx].products);
        }
        drag = null;
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });

    document.addEventListener('keydown', e => {
        if (overlay.hidden || !$('lightbox').hidden) return;
        if (e.key === 'Escape') {
            if (mode === 'room') switchSpace('hall'); else if (mode === 'hall') close();
        } else if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
            e.preventDefault(); pan(mode === 'hall' ? 4 : 4);
        } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
            e.preventDefault(); pan(-4);
        }
    });

    window.addEventListener('resize', resize);

    // Enlace directo: tudominio.com/?boutique (o #boutique) abre el vestíbulo al entrar
    if (/[?&#]boutique\b/.test(location.search + location.hash)) open();
})();
