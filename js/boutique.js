// Boutique virtual CAME: un vestíbulo elegante con una puerta por sección.
// Cada puerta lleva a una sala de museo con las joyas colgadas como cuadros.
// Three.js se descarga solo cuando la clienta entra. Usa CATEGORIES, products,
// formatPrice y openLightbox de main.js.
(() => {
    const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

    // Paleta: fondo claro marfil-rosado, puertas vino y dorado champán
    const C = {
        sky: 0xF6ECE8,
        wall: 0xF7EEEA,
        wainscot: 0xE3CDCB,
        ceiling: 0xFFFFFF,
        door: 0x2B2725,
        doorInset: 0x433D3A,
        pilaster: 0xFFF8F2,
        gold: 0xCFAE6A,
        mat: 0xFFFFFF,
    };

    const EYE = 1.7;
    const OFFSET = 200;              // cada sala vive a 200 unidades de la anterior
    const DOOR_HW = 1.2;             // mitad del ancho de la puerta
    const DOOR_RECT_H = 3.2;         // alto de la parte recta (arriba va el arco)
    const DOOR_GAP = 4;
    const HALL = { halfW: 15, h: 7, zFront: 7, zBack: -7 };
    const HALL_CAM_Z = 4;            // distancia de la cámara a las puertas ≈ 11
    const ROOM = { halfW: 3.2, h: 5.5 };
    // Las joyas flotan una tras otra en el centro de la sala, de frente a la clienta.
    // La cámara hace un zigzag suave para quedar justo frente a cada una.
    const SPACING = 4.2;             // distancia entre joyas
    const FIRST = 3.2;               // la primera queda a esta distancia al entrar
    const STAGGER = 0.7;             // cada joya se corre a un lado, alternando
    const FLOAT_Y = 1.9;
    const PIC_H = 1.9;
    const PIC_MAX_W = 1.5;           // cabe en pantallas verticales de celular
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
    let introPush = 0;               // la cámara arranca más atrás y avanza al entrar
    let introToken = 0;
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

    // Piso de porcelanato tipo mármol: losas grandes con vetas y juntas finas
    function marbleTexture(repX, repY) {
        const t = canvasTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            for (let k = 0; k < 14; k++) {           // nubes suaves
                const x = Math.random() * w, y = Math.random() * h, r = 60 + Math.random() * 110;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, Math.random() < 0.5 ? 'rgba(225,210,212,0.35)' : 'rgba(255,255,255,0.45)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
            for (let k = 0; k < 7; k++) {            // vetas
                ctx.strokeStyle = `rgba(165,145,150,${0.14 + Math.random() * 0.14})`;
                ctx.lineWidth = 0.8 + Math.random() * 1.6;
                ctx.beginPath();
                let x = Math.random() * w, y = 0;
                ctx.moveTo(x, y);
                while (y < h) {
                    x += (Math.random() - 0.4) * 38;
                    y += 30 + Math.random() * 30;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(180,160,120,0.55)';   // junta
            ctx.lineWidth = 3;
            ctx.strokeRect(0, 0, w, h);
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repX, repY);
        return t;
    }

    // Lo que se ve a través de la puerta: la foto de una joya de la sala, a todo el arco
    function showcaseTexture(imgUrl) {
        const W = 512, H = 683;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.85);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#FBEFEF'); g.addColorStop(1, '#EBD3D6');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        if (imgUrl) new THREE.TextureLoader().load(imgUrl, t => {
            // la foto llena todo el arco, sin marco
            const im = t.image, k = Math.max(W / im.width, H / im.height);
            ctx.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k);
            tex.needsUpdate = true;
        });
        return tex;
    }

    function makeSign(title, subtitle, width) {
        const tex = canvasTexture(1440, 360, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            roundRect(ctx, 8, 8, w - 16, h - 16, 24);
            ctx.fill();
            ctx.strokeStyle = '#CFAE6A';
            ctx.lineWidth = 6;
            roundRect(ctx, 24, 24, w - 48, h - 48, 16);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6B1A33';
            ctx.font = 'italic 400 150px "Cormorant Garamond", serif';
            ctx.fillText(title, w / 2, subtitle ? 200 : 235);
            if (subtitle) {
                ctx.fillStyle = '#A66A7D';
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
            ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
            roundRect(ctx, 4, 4, w - 8, h - 8, 14);
            ctx.fill();
            ctx.strokeStyle = '#CFAE6A';
            ctx.lineWidth = 3;
            roundRect(ctx, 10, 10, w - 20, h - 20, 10);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6B1A33';
            ctx.font = 'italic 400 52px "Cormorant Garamond", serif';
            ctx.fillText(name, w / 2, 76);
            ctx.fillStyle = '#A66A7D';
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
            std(0xffffff, 0.06, 0.12, { emissive: 0xFFFFFF, emissiveIntensity: 0.04, map: marbleTexture((halfW * 2) / 3, len / 3) })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, mid);
        g.add(floor);

        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, len), std(C.ceiling));
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, h, mid);
        g.add(ceiling);

        // franjas de luz empotradas, como en una joyería
        const stripMat = new THREE.MeshBasicMaterial({ color: 0xFFF4DC });
        const cols = halfW > 8 ? [-10, -5, 0, 5, 10] : [0];
        for (let z = zFront - 2; z > zBack + 1; z -= 4) {
            cols.forEach(x => {
                const strip = new THREE.Mesh(new THREE.BoxGeometry(halfW > 8 ? 3 : halfW * 1.1, 0.04, 0.3), stripMat);
                strip.position.set(x, h - 0.02, z);
                g.add(strip);
            });
        }

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

        // al otro lado de la puerta: una vitrina iluminada con una joya de la sala
        const cover = products.find(p => p.category === cat.name && p.name === cat.cover) || products.find(p => p.category === cat.name);
        const portalTex = showcaseTexture(cover && cover.img);
        portalTex.repeat.set(1 / (2 * hw), 1 / (hr + hw));
        portalTex.offset.set(0.5, 0);
        const portal = new THREE.Mesh(
            new THREE.ShapeGeometry(archShape(hw, hr), 24),
            new THREE.MeshBasicMaterial({ map: portalTex })
        );
        portal.position.z = 0.13;
        g.add(portal);

        // hojas laqueadas en rosa polvo (tono sobre tono con la sala), con panel más claro y filetes dorados
        const lacquer = (color, rough) => new THREE.MeshStandardMaterial({
            color, roughness: rough, metalness: 0.2, side: THREE.DoubleSide,
            emissive: 0x8A5A58, emissiveIntensity: 0.12,
        });
        const doorMat = lacquer(0xE2C3C0, 0.14);
        const insetMat = lacquer(0xF4E4E1, 0.1);
        const edgeMat = new THREE.LineBasicMaterial({ color: C.gold });
        const leafGeo = extrude(leafShape(hw, hr), 0.1);
        const edgeGeo = new THREE.EdgesGeometry(leafGeo);
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
            const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.07), goldMat());
            knob.position.set(-0.17, 2.0, 0.22);
            [leaf, inset].forEach(m => { m.userData.doorIndex = i; hits.push(m); });
            const insetEdge = new THREE.LineSegments(edgeGeo, edgeMat);
            insetEdge.scale.copy(inset.scale);
            insetEdge.position.copy(inset.position);
            flip.add(leaf, inset, new THREE.LineSegments(edgeGeo, edgeMat), insetEdge, knob);
            g.add(pivot);
            pivots.push(pivot);
        });

        const sign = makeSign(cat.name, `Entra · ${cat.items.length} piezas`, 2.9);
        sign.position.set(0, hr + hw + 0.6, 0.1);
        g.add(sign);

        // aura champán detrás del arco
        const auraTex = glowTexture([[0, 'rgba(240,200,190,0.55)'], [0.5, 'rgba(246,222,215,0.25)'], [1, 'rgba(252,240,236,0)']]);
        const aura = new THREE.Mesh(
            new THREE.PlaneGeometry(hw * 4.6, (hr + hw) * 1.55),
            new THREE.MeshBasicMaterial({ map: auraTex, transparent: true, depthWrite: false })
        );
        aura.position.set(0, (hr + hw) / 2, 0.015);
        g.add(aura);

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

        hall.sparkles = makeSparkles(90, { x0: -14, x1: 14, y0: 0.4, y1: 6.5, z0: -6.5, z1: 5 });
        g.add(hall.sparkles);

        scene.add(g);
        hall.group = g;
    }

    // ---------- Salas de museo ----------
    function addPiece(room, product, side, z) {   // side: -1 | 1
        const g = new THREE.Group();
        g.position.set(side * STAGGER, FLOAT_Y, z);
        g.userData.phase = z;

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), goldMat());
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: C.mat }));
        mat.position.z = 0.055;
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xF3E6E4 }));
        pic.position.z = 0.058;
        pic.userData.productIndex = products.indexOf(product);

        const plaque = makePlaque(product.name, product.sold ? 'SOLD OUT · pieza única' : formatPrice(product.price));
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
        room.floaters.push(g);

        // charco de luz dorada en el piso, como foco de museo
        const pool = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 3.2),
            new THREE.MeshBasicMaterial({ map: room.poolTex, transparent: true, depthWrite: false })
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(side * STAGGER, 0.02, z);
        room.group.add(pool);
    }

    function buildRoom(cat, idx, poolTex) {
        const list = products.filter(p => p.category === cat.name);
        const maxTravel = Math.max(0, list.length - 1) * SPACING;
        const zBack = -(FIRST + maxTravel + 5);

        const group = new THREE.Group();
        group.position.set(OFFSET * (idx + 1), 0, 0);
        group.visible = false;
        addShell(group, { halfW: ROOM.halfW, h: ROOM.h, zFront: 4, zBack });

        const room = { name: cat.name, group, offsetX: group.position.x, pictures: [], floaters: [], products: list, maxTravel, poolTex, sparkles: null };

        list.forEach((p, k) => {
            addPiece(room, p, k % 2 === 0 ? -1 : 1, -(FIRST + k * SPACING));
        });

        const sign = makeSign(cat.name, `${list.length} piezas`, 3.6);
        sign.position.set(0, 3.3, zBack + 0.05);
        group.add(sign);

        room.sparkles = makeSparkles(60, { x0: -2.7, x1: 2.7, y0: 0.4, y1: ROOM.h - 0.4, z0: zBack + 0.5, z1: 3 });
        group.add(room.sparkles);

        scene.add(group);
        return room;
    }

    // Sala final: una invitación grande para escribir por WhatsApp
    const FINALE_WA = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola CAME ✨ recorrí la boutique virtual y quiero una joya')}`;

    function buildFinale(idx, poolTex) {
        const zBack = -9;
        const group = new THREE.Group();
        group.position.set(OFFSET * (idx + 1), 0, 0);
        group.visible = false;
        addShell(group, { halfW: ROOM.halfW, h: ROOM.h, zFront: 4, zBack });

        const tex = canvasTexture(1200, 1000, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
            roundRect(ctx, 10, 10, w - 20, h - 20, 40);
            ctx.fill();
            ctx.strokeStyle = '#CFAE6A';
            ctx.lineWidth = 8;
            roundRect(ctx, 34, 34, w - 68, h - 68, 28);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6B1A33';
            ctx.font = 'italic 400 230px "Cormorant Garamond", serif';
            ctx.fillText('CAME', w / 2, 330);
            ctx.fillStyle = '#A66A7D';
            ctx.font = '400 34px Montserrat, sans-serif';
            ctx.fillText('J O Y E R Í A   C O N   A L M A', w / 2, 400);
            ctx.fillStyle = '#6B1A33';
            ctx.font = 'italic 400 84px "Cormorant Garamond", serif';
            ctx.fillText('¿Encontraste tu joya?', w / 2, 560);
            ctx.font = 'italic 400 60px "Cormorant Garamond", serif';
            ctx.fillStyle = '#8A4A5E';
            ctx.fillText('Cada pieza es única, como tú.', w / 2, 640);
            const g = ctx.createLinearGradient(220, 0, w - 220, 0);
            g.addColorStop(0, '#E3C98C'); g.addColorStop(1, '#CFAE6A');
            ctx.fillStyle = g;
            roundRect(ctx, 200, 730, w - 400, 130, 65);
            ctx.fill();
            ctx.fillStyle = '#6B1A33';
            ctx.font = '500 40px Montserrat, sans-serif';
            ctx.fillText('ESCRÍBENOS POR WHATSAPP', w / 2, 810);
        });
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(4.4, 4.4 * 1000 / 1200),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        panel.position.set(0, 3.0, zBack + 0.06);
        panel.userData.cta = true;
        group.add(panel);

        const pool = new THREE.Mesh(
            new THREE.PlaneGeometry(7, 7),
            new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false })
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, 0.02, -3);
        group.add(pool);

        const sparkles = makeSparkles(70, { x0: -2.7, x1: 2.7, y0: 0.4, y1: ROOM.h - 0.4, z0: zBack + 0.5, z1: 3 });
        group.add(sparkles);

        scene.add(group);
        return { name: 'Te esperamos', finale: true, group, offsetX: group.position.x, pictures: [panel], floaters: [], products: [], maxTravel: 0, poolTex, sparkles };
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

        scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xF0DCDD, 0.8));
        const lamp = new THREE.PointLight(0xFFE6BF, 0.6, 16);
        lamp.position.set(0, 0.6, -1);
        camera.add(lamp);

        const poolTex = glowTexture([[0, 'rgba(255,226,150,0.55)'], [0.6, 'rgba(255,226,150,0.18)'], [1, 'rgba(255,226,150,0)']]);

        buildHall();
        CATEGORIES.forEach((cat, i) => rooms.push(buildRoom(cat, i, poolTex)));
        rooms.push(buildFinale(CATEGORIES.length, poolTex));
        buildNav();
        built = true;
    }

    // ---------- HUD ----------
    function buildNav() {
        $('boutiqueNav').innerHTML =
            `<button class="boutique-chip" data-go="hall">Vestíbulo</button>` +
            rooms.map((r, i) => `<button class="boutique-chip" data-go="${i}">${r.name}</button>`).join('');
    }

    const ctaEl = $('boutiqueCta');
    let ctaState = '';
    let hudKey = '';
    function updateHud() {
        const key = `${mode === 'busy' ? 'b' : mode}${roomIdx}`;
        if (key !== hudKey && mode !== 'busy') {
            hudKey = key;
            $('boutiqueRoom').textContent = mode === 'hall' ? 'Elige tu puerta' : rooms[roomIdx].name;
            hint.textContent = mode === 'hall'
                ? 'Desliza para ver las puertas · toca una para entrar'
                : rooms[roomIdx].finale
                    ? 'Toca el letrero para escribirnos por WhatsApp'
                    : 'Desliza hacia arriba para ver la siguiente joya · toca una para verla de cerca';
            hint.classList.remove('gone');
            overlay.querySelectorAll('.boutique-chip').forEach(el => {
                const go = el.dataset.go;
                el.classList.toggle('active', mode === 'hall' ? go === 'hall' : go === String(roomIdx));
            });
        }
        let pct = 0;
        if (mode === 'hall') pct = (hall.x - hall.minX) / ((hall.maxX - hall.minX) || 1);
        else if (mode === 'room') pct = rooms[roomIdx].finale ? 1 : travel / (rooms[roomIdx].maxTravel || 1);
        $('boutiqueBar').style.width = `${clamp(pct, 0, 1) * 100}%`;

        // botón grande: al llegar a la última joya invita a la sala final; allí, a WhatsApp
        let cta = null;
        if (mode === 'room') {
            const r = rooms[roomIdx];
            if (r.finale) cta = { text: 'Escríbenos por WhatsApp', href: FINALE_WA };
            else if (travelTarget >= r.maxTravel - 0.01) cta = { text: 'Seguir a la sala final ✨', href: '#' };
        }
        const ctaKey = cta ? cta.text : '';
        if (ctaKey !== ctaState) {
            ctaState = ctaKey;
            ctaEl.hidden = !cta;
            if (cta) { ctaEl.textContent = cta.text; ctaEl.href = cta.href; }
        }
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

    const roomSide = k => (k % 2 === 0 ? -1 : 1);

    // Al soltar, la cámara se acomoda frente a la joya más cercana
    let snapTimer = 0;
    function snap() {
        if (mode !== 'room') return;
        const max = rooms[roomIdx].maxTravel;
        travelTarget = clamp(Math.round(travelTarget / SPACING) * SPACING, 0, max);
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
            camera.position.set(hall.x + sway.x * 0.3, EYE, HALL_CAM_Z + introPush);
        } else if (mode === 'room') {
            travel += (travelTarget - travel) * 0.08;
            const r = rooms[roomIdx];
            if (r.finale) {
                camera.position.set(r.offsetX + sway.x * 0.3, EYE, 0);
            } else {
                const f = travel / SPACING, i0 = Math.floor(f), k = ease(f - i0);
                const xa = roomSide(i0) * STAGGER, xb = roomSide(Math.min(i0 + 1, r.products.length - 1)) * STAGGER;
                camera.position.set(r.offsetX + lerp(xa, xb, k) + sway.x * 0.3, EYE, -travel);
            }
            r.floaters.forEach(g => { g.position.y = FLOAT_Y + Math.sin(t * 1.1 + g.userData.phase) * 0.06; });
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
        if (hit && hit.object.userData.cta) return { cta: true };
        return hit ? { piece: hit.object.userData.productIndex } : null;
    }

    // ---------- Música ambiental ----------
    // Generada con Web Audio (sin archivos): acordes suaves en capas + campanitas tipo cajita de música.
    const music = (() => {
        // Vals de salón en Re mayor (3/4): bajo en el 1, acordes en el 2 y 3, arpa que fluye
        // y una melodía de celesta propia. Todo se genera aquí, sin archivos de audio.
        const BEAT = 0.4;                       // ≈150 pulsos por minuto: ligero y bailable
        const BAR = BEAT * 3;
        const hz = m => 440 * Math.pow(2, (m - 69) / 12);
        // [bajo, acorde] por compás (8 compases): D · Bm · Em · A7 · D · G · A · D
        const BARS = [
            { bass: 38, chord: [62, 66, 69] },
            { bass: 47, chord: [62, 66, 71] },
            { bass: 40, chord: [64, 67, 71] },
            { bass: 45, chord: [61, 64, 67] },
            { bass: 38, chord: [62, 66, 69] },
            { bass: 43, chord: [59, 62, 67] },
            { bass: 45, chord: [61, 64, 69] },
            { bass: 38, chord: [62, 66, 69] },
        ];
        // melodía: [pulso dentro del compás, nota MIDI, duración en pulsos]
        const MELODY = [
            [[0, 78, 1.5], [1.5, 76, 0.5], [2, 74, 1]],
            [[0, 74, 1], [1, 78, 1], [2, 83, 1]],
            [[0, 83, 1.5], [1.5, 81, 0.5], [2, 79, 1]],
            [[0, 78, 1], [1, 76, 1], [2, 73, 1]],
            [[0, 74, 1], [1, 78, 1], [2, 81, 1]],
            [[0, 86, 1.5], [1.5, 83, 0.5], [2, 79, 1]],
            [[0, 81, 1], [1, 78, 1], [2, 76, 1]],
            [[0, 74, 3]],
        ];
        let ctx = null, master = null, bus = null, timer = 0;
        let wanted = false, chordIdx = 0, nextChord = 0, nextBell = 0, cur = BARS[0];
        let muted = false;
        try { muted = localStorage.getItem('came-music') === 'off'; } catch (_) { /* sin almacenamiento */ }

        function impulse(secs) {   // reverberación de "salón de baile" hecha con ruido que se apaga
            const len = Math.floor(ctx.sampleRate * secs);
            const buf = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = buf.getChannelData(ch);
                for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
            }
            return buf;
        }

        function init() {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 5600;
            bus = ctx.createGain();
            const dry = ctx.createGain();
            dry.gain.value = 0.85;
            const verb = ctx.createConvolver();
            verb.buffer = impulse(2.6);
            const wet = ctx.createGain();
            wet.gain.value = 0.75;
            bus.connect(dry); dry.connect(lp);
            bus.connect(verb); verb.connect(wet); wet.connect(lp);
            lp.connect(master);
            master.connect(ctx.destination);
            return true;
        }

        function out(node, pan) {
            if (ctx.createStereoPanner) {
                const p = ctx.createStereoPanner();
                p.pan.value = pan;
                node.connect(p); p.connect(bus);
            } else node.connect(bus);
        }

        // nota de arpa / celesta: ataque instantáneo y cola que se apaga
        function pluck(freq, t0, vel, pan, len = 1.6) {
            [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3.01, 0.08, 'sine']].forEach(([mult, k, type]) => {
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.value = freq * mult;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(vel * k, t0 + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + len / (mult > 1 ? 1.6 : 1));
                o.connect(g); out(g, pan);
                o.start(t0);
                o.stop(t0 + len + 0.1);
            });
        }

        // cuerdas suaves que acompañan: entran y salen dentro del compás
        function swell(freq, t0, len, amp, pan) {
            [-5, 5].forEach(cents => {
                const o = ctx.createOscillator();
                o.type = 'triangle';
                o.frequency.value = freq;
                o.detune.value = cents;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(amp, t0 + len * 0.4);
                g.gain.linearRampToValueAtTime(0, t0 + len * 1.15);
                o.connect(g); out(g, pan);
                o.start(t0);
                o.stop(t0 + len * 1.2);
            });
        }

        function playBar(t0, n) {
            const bar = BARS[n % 8];
            const cycle = Math.floor(n / 8);
            cur = bar;
            // bajo en el 1 (con acento) y acordes ligeros en el 2 y el 3
            pluck(hz(bar.bass), t0, 0.1, -0.2, 0.9);
            pluck(hz(bar.bass + 12), t0, 0.03, -0.2, 0.7);
            [1, 2].forEach(b => bar.chord.forEach((m, i) => pluck(hz(m), t0 + b * BEAT, 0.02, (i - 1) * 0.3, 0.45)));
            bar.chord.forEach((m, i) => swell(hz(m), t0, BAR, 0.01, (i - 1) * 0.4));
            // arpa: seis corcheas que suben y bajan por el acorde
            const [a, b, c] = bar.chord.map(m => m + 12);
            [a, b, c, a + 12, c, b].forEach((m, i) => {
                pluck(hz(m), t0 + i * BEAT / 2, 0.026, Math.sin(i + n) * 0.5, 1.1);
            });
            // melodía de celesta; en los ciclos impares los 4 primeros compases suben una octava
            const lift = cycle % 2 && n % 8 < 4 ? 12 : 0;
            MELODY[n % 8].forEach(([beat, m, len]) => {
                pluck(hz(m + lift), t0 + beat * BEAT, 0.075, 0.15, 0.7 + len * BEAT * 1.4);
            });
        }

        function tick() {
            if (!ctx || ctx.state !== 'running') return;
            const now = ctx.currentTime;
            while (nextChord < now + 1.5) {
                playBar(nextChord, chordIdx);
                chordIdx++;
                nextChord += BAR;
            }
            while (nextBell < now + 1.5) {   // destellos agudos sueltos, como polvo de hadas
                const m = cur.chord[Math.floor(Math.random() * cur.chord.length)] + 36;
                pluck(hz(m), nextBell, 0.014, Math.random() * 1.6 - 0.8, 1.8);
                nextBell += 0.9 + Math.random() * 2;
            }
        }
        function fadeTo(v, secs) {
            if (!master) return;
            const t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.linearRampToValueAtTime(v, t + secs);
        }

        function play() {
            if (!wanted || muted) return;
            if (!ctx && !init()) return;
            const go = () => {
                if (!wanted || muted || ctx.state !== 'running') return;
                if (!timer) {
                    nextChord = nextBell = ctx.currentTime + 0.1;
                    timer = setInterval(tick, 400);
                    tick();
                }
                fadeTo(0.9, 4);
            };
            if (ctx.state === 'running') go();
            else ctx.resume().then(go).catch(() => { /* el navegador exige un toque primero */ });
        }

        function halt() {
            if (!ctx) return;
            fadeTo(0, 0.6);
            clearInterval(timer);
            timer = 0;
            setTimeout(() => { if (!timer && ctx.state === 'running') ctx.suspend(); }, 800);
        }

        function paint() {
            const b = $('boutiqueMusic');
            b.setAttribute('aria-pressed', String(!muted));
            b.setAttribute('aria-label', muted ? 'Activar música' : 'Silenciar música');
        }

        return {
            start() { wanted = true; paint(); play(); },
            stop() { wanted = false; halt(); },
            kick() { if (wanted && !muted && ctx && ctx.state !== 'running') play(); else if (wanted && !muted && !ctx) play(); },
            toggle() {
                muted = !muted;
                try { localStorage.setItem('came-music', muted ? 'off' : 'on'); } catch (_) { /* sin almacenamiento */ }
                paint();
                if (muted) halt(); else play();
            },
            pause() { if (ctx && timer) halt(); },
            resume() { play(); },
        };
    })();

    // ---------- Abrir / cerrar ----------
    async function open() {
        music.start();
        overlay.hidden = false;
        document.body.classList.add('in-boutique');
        document.body.style.overflow = 'hidden';
        introToken++;
        introPush = 0;
        const box = $('boutiqueLoading');
        box.classList.remove('welcome', 'leaving');
        box.hidden = false;
        try {
            await loadThree();
            if (!built) await build();
        } catch (_) {
            close();
            enterBtn.hidden = true;   // sin Three.js queda el catálogo normal
            return;
        }
        if (overlay.hidden) return;
        fade.classList.remove('on');
        showSpace('hall');
        resize();
        if (!raf) frame();
        await welcome();
    }

    // Entrada mágica: mensaje de bienvenida que se disuelve mientras la cámara avanza hacia las puertas
    async function welcome() {
        const my = ++introToken;
        const box = $('boutiqueLoading');
        const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const alive = () => my === introToken && !overlay.hidden;
        introPush = calm ? 0 : 2.6;
        box.classList.add('welcome');
        await sleep(calm ? 700 : 1700);
        if (!alive()) return;
        box.classList.add('leaving');
        const p0 = introPush;
        await tween(calm ? 1 : 1500, k => { if (alive()) introPush = p0 * (1 - ease(k)); });
        if (!alive()) return;
        introPush = 0;
        box.hidden = true;
    }

    function close() {
        music.stop();
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

    ctaEl.addEventListener('click', e => {
        if (ctaEl.getAttribute('href') !== '#') return;   // WhatsApp: abre el enlace normal
        e.preventDefault();
        switchSpace(rooms.length - 1);
    });

    $('boutiqueNav').addEventListener('click', e => {
        const chip = e.target.closest('[data-go]');
        if (!chip || mode === 'busy') return;
        const go = chip.dataset.go;
        if (go === 'hall') {
            if (mode === 'room') switchSpace('hall');
        } else if (mode === 'hall') {
            if (rooms[Number(go)].finale) switchSpace(Number(go));   // la sala final no tiene puerta
            else enterRoom(Number(go));
        } else if (Number(go) !== roomIdx) {
            switchSpace(Number(go));
        }
    });

    overlay.addEventListener('wheel', e => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : 1;
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        pan(d * (mode === 'hall' ? 0.01 : 0.012));
        clearTimeout(snapTimer);
        snapTimer = setTimeout(snap, 140);
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
            else if (h && h.cta) window.open(FINALE_WA, '_blank', 'noopener');
            else if (h && h.piece !== undefined) openLightbox(products[h.piece], rooms[roomIdx].products);
        } else if (drag && mode === 'room') snap();
        drag = null;
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });

    document.addEventListener('keydown', e => {
        if (overlay.hidden || !$('lightbox').hidden) return;
        if (e.key === 'Escape') {
            if (mode === 'room') switchSpace('hall'); else if (mode === 'hall') close();
        } else if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
            e.preventDefault(); pan(mode === 'hall' ? 4 : SPACING);
        } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
            e.preventDefault(); pan(mode === 'hall' ? -4 : -SPACING);
        }
    });

    $('boutiqueMusic').addEventListener('click', () => music.toggle());
    overlay.addEventListener('pointerdown', () => music.kick());   // enlace directo: el navegador pide un toque antes de sonar
    document.addEventListener('visibilitychange', () => {
        if (overlay.hidden) return;
        if (document.hidden) music.pause(); else music.resume();
    });

    window.addEventListener('resize', resize);

    // Enlace directo: tudominio.com/?boutique (o #boutique) abre el vestíbulo al entrar
    if (/[?&#]boutique\b/.test(location.search + location.hash)) open();
})();
