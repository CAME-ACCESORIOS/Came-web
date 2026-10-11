// Efecto 3D tilt + reflejo de luz (glare) para las fotos de producto.
// Usa delegación de eventos: funciona aunque main.js vuelva a dibujar el catálogo al filtrar.
(() => {
    const MAX_TILT = 9; // grados de inclinación máxima

    // Solo en dispositivos con mouse y si la usuaria no pidió reducir movimiento
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!canHover.matches || reduceMotion.matches) return;

    let active = null;
    let frame = null;

    function reset(el) {
        if (!el) return;
        el.classList.remove('is-tilting');
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
        el.style.removeProperty('--glare-x');
        el.style.removeProperty('--glare-y');
    }

    function tilt(el, e) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;   // 0 → 1
        const y = (e.clientY - r.top) / r.height;   // 0 → 1
        el.classList.add('is-tilting');
        el.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
        el.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
    }

    document.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest('.product-img-wrapper');
        if (el !== active) {
            reset(active);
            active = el;
        }
        if (!el) return;
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => tilt(el, e));
    });

    // El mouse sale de la ventana o se abre el lightbox
    document.documentElement.addEventListener('pointerleave', () => { reset(active); active = null; });
    document.addEventListener('click', () => { reset(active); active = null; });
})();
