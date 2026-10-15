const WHATSAPP = '50762721611';

// Para agregar una pieza: sumar su nombre AL FINAL de la categoría (la foto va en Imagenes/web/<Categoría>/<Nombre>.jpg).
// Pieza vendida (son únicas): agregar ' SOLD OUT' al final del nombre de la foto y de la lista, ej. 'Set azul SOLD OUT'.
// 'cover' es la foto que se ve detrás de la puerta de la boutique (mejor una de producto o de cuello/oreja bien centrada).
// Las piezas más recientes (las del final de la lista) se muestran primero en el catálogo y en la boutique.
const CATEGORIES = [
    { name: 'Collares', cover: 'Collar corazon dorado', price: 20, item: 'el collar', ask: 'pedirlo', items: ['Collar corazon dorado', 'Collar gota de agua', 'Collar mini corazon', 'Collar con dije de honguito', 'Collar con dije de pajarito'] },
    { name: 'Aretes', cover: 'Aretes moño rosa 2', price: 10, item: 'los aretes', ask: 'pedirlos', items: ['MariCristal', 'Aretes azulado', 'Aretes azulado2', 'Aretes corazon pasion', 'Aretes corazon', 'Aretes elefante dorado', 'Aretes luna', 'Aretes moño rosa', 'Aretes moño rosa 2', 'Aretes perla cuadrada', 'Aretes circulares dorada', 'Aretes cristal lilas', 'Aretes cuadrados', 'Aretes de moñito perlado', 'Aretes de perla', 'Aretes flor', 'Aretes tortuga celeste', 'Aretes tortuga negro'] },
    { name: 'Pulseras', cover: 'Pulsera trebol marino', price: 18, item: 'la pulsera', ask: 'pedirla', items: ['Pulsera dijes de mar', 'Pulsera trebol marino', 'Pulsera de bolitas doradas', 'Pulsera de corazones', 'Pulsera de MAMA', 'Pulsera sencilla azul', 'Pulsera tejida con bolitas', 'Pulsera treanzada'] },
    { name: 'Sets', cover: 'Set concha de caracol', price: 28, item: 'el set', ask: 'pedirlo', items: ['Set azul', 'Set concha de caracol', 'Set dijes de mar', 'Set flor dorada SOLD OUT', 'Set perlado', 'Collar concha y perla', 'Collar mar-caracol', 'Set corazon rojo', 'Set circular dorado', 'Set conchitas de mar', 'Set hoja dorada', 'Set flor esmeralda', 'Set tejido virgen', 'Set piedras y cruz', 'Set petalos de cristal', 'Set petalos de cristal2', 'Set cadena con dije de virgen', 'Set corazon oscuro', 'Set de mariposa'] },
];

const SOLD_RE = /\s*SOLD OUT$/i;

const products = CATEGORIES.flatMap(c => [...c.items].reverse().map(file => {
    const name = file.replace(SOLD_RE, '');
    return {
        name,
        category: c.name,
        price: c.price,
        sold: SOLD_RE.test(file),
        img: `Imagenes/web/${c.name}/${file}.jpg`,
        wa: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, me encantó ${c.item} ${name} y quiero ${c.ask}`)}`,
    };
}).sort((a, b) => a.sold - b.sold));   // las vendidas van al final de su categoría

const $ = id => document.getElementById(id);
const formatPrice = p => `$${p.toFixed(2)} USD`;

function renderCategories() {
    $('categoryGrid').innerHTML = CATEGORIES.map(c => {
        const cover = products.find(p => p.category === c.name);
        return `<button class="category-card" data-filter="${c.name}">
            <img src="${cover.img}" alt="" loading="lazy">
            <span class="category-label">${c.name}<small>${c.items.length} piezas</small></span>
        </button>`;
    }).join('');
}

let activeFilter = 'all';
const listFor = filter => filter === 'all' ? products : products.filter(p => p.category === filter);

function renderProducts(filter = 'all') {
    activeFilter = filter;
    const list = listFor(filter);
    $('catalogTitle').textContent = filter === 'all' ? 'Todas las piezas' : filter;
    $('showAll').hidden = filter === 'all';
    $('productGrid').innerHTML = list.map(p => `
        <article class="product-card${p.sold ? ' is-sold' : ''}">
            <button class="product-img-wrapper" data-index="${products.indexOf(p)}" aria-label="Ver ${p.name} en grande">
                <img src="${p.img}" alt="${p.category}: ${p.name}" loading="lazy">
                <span class="glare" aria-hidden="true"></span>
                ${p.sold ? '<span class="sold-badge">SOLD OUT</span>' : ''}
            </button>
            <div class="product-info">
                <h4>${p.name}</h4>
                <p class="price">${p.sold ? 'SOLD OUT · pieza única' : formatPrice(p.price)}</p>
                ${p.sold ? '' : `<a class="buy-link" href="${p.wa}" target="_blank" rel="noopener">Pedir por WhatsApp</a>`}
            </div>
        </article>`).join('');
    document.querySelectorAll('.category-card').forEach(el => {
        el.classList.toggle('active', el.dataset.filter === filter);
    });
}

const lightbox = $('lightbox');
let lbList = [];
let lbPos = 0;

function renderLightbox() {
    const p = lbList[lbPos];
    const img = $('lightboxImg');
    img.style.opacity = 0;
    img.onload = () => { img.style.opacity = 1; };
    img.src = p.img;
    img.alt = `${p.category}: ${p.name}`;
    if (img.complete) img.style.opacity = 1;
    $('lightboxName').textContent = p.name;
    $('lightboxPrice').textContent = p.sold ? 'SOLD OUT · pieza única' : formatPrice(p.price);
    $('lightboxBuy').href = p.wa;
    $('lightboxBuy').hidden = p.sold;
    const many = lbList.length > 1;
    $('lightboxPrev').hidden = !many;
    $('lightboxNext').hidden = !many;
    $('lightboxCount').textContent = many ? `${lbPos + 1} / ${lbList.length}` : '';
    if (many) {   // precarga las vecinas para que el cambio sea instantáneo
        [1, -1].forEach(d => { new Image().src = lbList[(lbPos + d + lbList.length) % lbList.length].img; });
    }
}

// list = piezas por las que se navega con las flechas (por defecto, las del filtro activo)
function openLightbox(p, list = listFor(activeFilter)) {
    lbList = list.includes(p) ? list : [p];
    lbPos = lbList.indexOf(p);
    renderLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
}

function stepLightbox(dir) {
    if (lbList.length < 2) return;
    lbPos = (lbPos + dir + lbList.length) % lbList.length;
    renderLightbox();
}

function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = document.body.classList.contains('in-boutique') ? 'hidden' : '';
}

document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    renderProducts();

    document.addEventListener('click', e => {
        const filterEl = e.target.closest('[data-filter]');
        if (filterEl) {
            e.preventDefault();
            renderProducts(filterEl.dataset.filter);
            $('catalog').scrollIntoView({ behavior: 'smooth' });
            return;
        }
        const imgBtn = e.target.closest('.product-img-wrapper');
        if (imgBtn) openLightbox(products[imgBtn.dataset.index]);
    });

    lightbox.addEventListener('click', e => {
        if (e.target.closest('#lightboxPrev')) return stepLightbox(-1);
        if (e.target.closest('#lightboxNext')) return stepLightbox(1);
        if (e.target === lightbox || e.target.closest('#lightboxClose')) closeLightbox();
    });
    document.addEventListener('keydown', e => {
        if (lightbox.hidden) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') stepLightbox(-1);
        else if (e.key === 'ArrowRight') stepLightbox(1);
    });
    // Deslizar con el dedo para cambiar de foto
    let swipeX = null;
    lightbox.addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
        if (swipeX === null) return;
        const dx = e.changedTouches[0].clientX - swipeX;
        swipeX = null;
        if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Menú móvil
    const menuBtn = $('mobileMenuBtn');
    const nav = $('navLinks');
    menuBtn.addEventListener('click', () => {
        menuBtn.setAttribute('aria-expanded', nav.classList.toggle('open'));
    });
    nav.addEventListener('click', e => {
        if (e.target.tagName === 'A') {
            nav.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
        }
    });
});
