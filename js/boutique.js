// Boutique virtual CAME: recorrido 3D por categorías con Three.js.
// Three.js se descarga solo cuando la clienta pulsa "Entrar a la boutique".
// Usa CATEGORIES, products, formatPrice y openLightbox de main.js.
(() => {
    const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

    // Medidas del pasillo (unidades de Three.js ≈ metros)
    const HALF_W = 3;        // mitad del ancho del pasillo
    const WALL_H = 4;
    const EYE = 1.7;         // altura de la cámara
    const SPACING = 4.4;     // distancia entre filas de cuadros
    const PIC_H = 1.7;
    const PIC_MAX_W = 2.3;
    const SCROLL_SPEED = 0.012;
    const DRAG_SPEED = 0.022;

    const $ = id => document.getElementById(id);
    const overlay = $('boutique');
    const enterBtn = $('enterBoutique');
    if (!overlay || !enterBtn) return;

    // Sin WebGL no hay boutique: el catálogo normal sigue disponible
    const hasWebGL = (() => {
        try {
            const c = document.createElement('canvas');
            return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
        } catch (_) { return false; }
    })();
    if (!hasWebGL) { enterBtn.hidden = true; return; }

    const canvas = $('boutiqueCanvas');
    const hint = $('boutiqueHint');
    let renderer, scene, camera;
    let built = false, raf = 0;
    let target = 0, current = 0, maxTravel = 0;
    const sway = { x: 0, y: 0, tx: 0, ty: 0 };
    const pictures = [];   // meshes que se pueden tocar
    const rooms = [];      // { name, start }

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

    // ---------- Helpers de texto en 3D ----------
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

    function makeSign(title, subtitle, width) {
        const tex = canvasTexture(1440, 360, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(253, 251, 247, 0.93)';
            roundRect(ctx, 8, 8, w - 16, h - 16, 24);
            ctx.fill();
            ctx.strokeStyle = '#C9A45C';
            ctx.lineWidth = 4;
            roundRect(ctx, 24, 24, w - 48, h - 48, 16);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6C5C56';
            ctx.font = 'italic 300 150px "Cormorant Garamond", serif';
            ctx.fillText(title, w / 2, subtitle ? 200 : 235);
            if (subtitle) {
                ctx.fillStyle = '#9B8D86';
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
            ctx.fillStyle = 'rgba(253, 251, 247, 0.96)';
            roundRect(ctx, 4, 4, w - 8, h - 8, 14);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6C5C56';
            ctx.font = 'italic 400 54px "Cormorant Garamond", serif';
            ctx.fillText(name, w / 2, 76);
            ctx.fillStyle = '#9B8D86';
            ctx.font = '400 28px Montserrat, sans-serif';
            ctx.fillText(price, w / 2, 124);
        });
        return new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 0.4375),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
    }

    // ---------- Construcción del pasillo ----------
    function addShell(zFront, zBack) {
        const len = zFront - zBack;
        const mid = (zFront + zBack) / 2;
        const std = (color, rough = 0.8, metal = 0) =>
            new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, len), std(0xe3cdbd, 0.5, 0.0));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, mid);
        scene.add(floor);

        const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, len), std(0xb98c78, 0.9));
        rug.rotation.x = -Math.PI / 2;
        rug.position.set(0, 0.01, mid);
        scene.add(rug);

        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, len), std(0x6b4336));
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, WALL_H, mid);
        scene.add(ceiling);

        [-1, 1].forEach(side => {
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H), std(0xc98f73));
            wall.rotation.y = -side * Math.PI / 2;   // mira hacia el centro
            wall.position.set(side * HALF_W, WALL_H / 2, mid);
            scene.add(wall);

            // tira de luz cálida en el techo
            const strip = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.05, len),
                new THREE.MeshBasicMaterial({ color: 0xffe2b8 })
            );
            strip.position.set(side * 2.2, WALL_H - 0.03, mid);
            scene.add(strip);
        });

        const end = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, WALL_H), std(0xb97d62));
        end.position.set(0, WALL_H / 2, zBack);
        scene.add(end);

        const endSign = makeSign('CAME', 'Gracias por visitarnos', 4.2);
        endSign.position.set(0, 2.2, zBack + 0.03);
        scene.add(endSign);
    }

    const frameMat = () => new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.6, roughness: 0.35 });

    function addPiece(product, productIndex, side, z) {
        const group = new THREE.Group();
        group.position.set(side * (HALF_W - 0.05), 1.85, z);
        group.rotation.y = -side * Math.PI / 2;   // mira hacia el centro del pasillo

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.08), frameMat());
        const pic = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xf3e6da })
        );
        pic.position.z = 0.045;
        pic.userData.productIndex = productIndex;

        const plaque = makePlaque(product.name, formatPrice(product.price));
        plaque.position.z = 0.02;

        function fit(aspect) {
            let h = PIC_H, w = h * aspect;
            if (w > PIC_MAX_W) { w = PIC_MAX_W; h = w / aspect; }
            pic.scale.set(w, h, 1);
            frame.scale.set(w + 0.18, h + 0.18, 1);
            plaque.position.y = -(h / 2) - 0.5;
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

        group.add(frame, pic, plaque);
        scene.add(group);
        pictures.push(pic);
    }

    async function build() {
        try {
            await Promise.all([
                document.fonts.load('italic 300 100px "Cormorant Garamond"'),
                document.fonts.load('italic 400 54px "Cormorant Garamond"'),
                document.fonts.load('400 30px Montserrat'),
            ]);
        } catch (_) { /* si falla, se usa la tipografía de respaldo */ }

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;

        scene = new THREE.Scene();
        const sky = new THREE.Color(0xe9b79d);
        scene.background = sky;
        scene.fog = new THREE.Fog(sky, 7, 30);

        camera = new THREE.PerspectiveCamera(60, 1, 0.1, 60);
        camera.position.set(0, EYE, 0);
        scene.add(camera);

        scene.add(new THREE.HemisphereLight(0xfff0e0, 0x8a5a44, 0.8));
        const lamp = new THREE.PointLight(0xffd9b0, 0.55, 14);
        lamp.position.set(0, 0.6, -1);
        camera.add(lamp);

        // Disposición: bienvenida + una sala por categoría
        let cursor = 10;
        const intro = makeSign('Bienvenida a CAME', 'Diseñada para brillar contigo', 3.2);
        intro.position.set(0, 2.9, -4.5);
        scene.add(intro);

        CATEGORIES.forEach(cat => {
            const start = cursor;
            const sign = makeSign(cat.name, `${cat.items.length} piezas`, 3.6);
            sign.position.set(0, 3.0, -(start + 1));
            scene.add(sign);

            const list = products.filter(p => p.category === cat.name);
            list.forEach((p, k) => {
                const side = k % 2 === 0 ? -1 : 1;
                const z = -(start + 4.5 + Math.floor(k / 2) * SPACING);
                addPiece(p, products.indexOf(p), side, z);
            });

            rooms.push({ name: cat.name, start });
            cursor += 4.5 + Math.ceil(list.length / 2) * SPACING + 1;
        });

        maxTravel = cursor;
        addShell(6, -(cursor + 4));

        buildNav();
        built = true;
    }

    // ---------- HUD ----------
    function buildNav() {
        $('boutiqueNav').innerHTML = rooms.map((r, i) =>
            `<button class="boutique-chip" data-room="${i}">${r.name}</button>`
        ).join('');
    }

    function currentRoom() {
        let idx = -1;
        rooms.forEach((r, i) => { if (current >= r.start - 4) idx = i; });
        return idx;
    }

    let lastRoom = -2;
    function updateHud() {
        const idx = currentRoom();
        if (idx !== lastRoom) {
            lastRoom = idx;
            $('boutiqueRoom').textContent = idx < 0 ? 'Bienvenida' : rooms[idx].name;
            overlay.querySelectorAll('.boutique-chip').forEach((el, i) =>
                el.classList.toggle('active', i === idx));
        }
        $('boutiqueBar').style.width = `${Math.min(100, (current / maxTravel) * 100)}%`;
    }

    // ---------- Movimiento y render ----------
    function move(delta) {
        const next = Math.max(0, Math.min(maxTravel, target + delta));
        if (next !== target) {
            target = next;
            hint.classList.add('gone');
        }
    }

    function frame() {
        raf = requestAnimationFrame(frame);
        current += (target - current) * 0.08;
        sway.x += (sway.tx - sway.x) * 0.05;
        sway.y += (sway.ty - sway.y) * 0.05;
        camera.position.z = -current;
        camera.position.x = sway.x * 0.3;
        camera.rotation.y = -sway.x * 0.1;
        camera.rotation.x = -sway.y * 0.05;
        renderer.render(scene, camera);
        updateHud();
    }

    function resize() {
        if (!renderer) return;
        const w = overlay.clientWidth, h = overlay.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = camera.aspect < 1 ? 78 : 60;   // más abierto en celular vertical
        camera.updateProjectionMatrix();
    }

    // ---------- Selección de piezas ----------
    function pick(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((clientX - r.left) / r.width) * 2 - 1,
            -((clientY - r.top) / r.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pictures)[0];
        return hit ? hit.object.userData.productIndex : null;
    }

    // ---------- Abrir / cerrar ----------
    async function open() {
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        $('boutiqueLoading').hidden = false;
        try {
            await loadThree();
            if (!built) await build();
        } catch (_) {
            close();
            enterBtn.hidden = true;   // sin conexión a Three.js: queda el catálogo normal
            return;
        }
        if (overlay.hidden) return;   // la clienta cerró mientras cargaba
        $('boutiqueLoading').hidden = true;
        hint.classList.remove('gone');
        resize();
        if (!raf) frame();
    }

    function close() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        overlay.hidden = true;
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
        const chip = e.target.closest('[data-room]');
        if (!chip) return;
        target = Math.max(0, rooms[chip.dataset.room].start - 4);
        hint.classList.add('gone');
    });

    overlay.addEventListener('wheel', e => {
        e.preventDefault();
        move(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * SCROLL_SPEED);
    }, { passive: false });

    let drag = null;
    canvas.addEventListener('pointerdown', e => {
        canvas.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, lastY: e.clientY, moved: 0 };
    });
    canvas.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse') {
            sway.tx = (e.clientX / window.innerWidth) * 2 - 1;
            sway.ty = (e.clientY / window.innerHeight) * 2 - 1;
            if (!drag && built) canvas.style.cursor = pick(e.clientX, e.clientY) === null ? 'grab' : 'pointer';
        }
        if (!drag) return;
        drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
        move((drag.lastY - e.clientY) * DRAG_SPEED);   // arrastrar hacia arriba = avanzar
        drag.lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', e => {
        if (drag && drag.moved < 6) {
            const i = pick(e.clientX, e.clientY);
            if (i !== null) openLightbox(products[i]);
        }
        drag = null;
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });

    document.addEventListener('keydown', e => {
        if (overlay.hidden) return;
        if (e.key === 'Escape') {
            if ($('lightbox').hidden) close();
        } else if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
            e.preventDefault(); move(4);
        } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
            e.preventDefault(); move(-4);
        }
    });

    window.addEventListener('resize', resize);

    // Enlace directo: tudominio.com/?boutique (o #boutique) abre el recorrido al entrar
    if (/[?&#]boutique\b/.test(location.search + location.hash)) open();
})();
