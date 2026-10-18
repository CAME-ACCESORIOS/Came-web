const WHATSAPP = '50762721611';

// Para agregar una pieza: sumar su nombre AL FINAL de la categoría (la foto va en Imagenes/web/<Categoría>/<Nombre>.jpg).
// Pieza vendida (son únicas): agregar ' SOLD OUT' al final del nombre de la foto y de la lista, ej. 'Set azul SOLD OUT'.
// Precio propio de una pieza: agregar '=precio' al final en la lista, ej. 'Set de corazon-plata 925=45' (la foto sigue llamándose sin el '=45').
// Si no lleva '=precio', usa el 'price' de la categoría.
// Material: todas las piezas son 'Acabado en rodio y baño de oro 18k' salvo que la categoría tenga su propio 'material' (ej. Plata 925).
// 'cover' es la foto que se ve detrás de la puerta de la boutique (mejor una de producto o de cuello/oreja bien centrada).
// Las piezas más recientes (las del final de la lista) se muestran primero en el catálogo y en la boutique.
const DEFAULT_MATERIAL = 'Acabado en rodio y baño de oro 18k';
const CATEGORIES = [
    { name: 'Collares', cover: 'Collar corazon dorado', price: 20, item: 'el collar', ask: 'pedirlo', items: ['Collar corazon dorado=18', 'Collar gota de agua=10', 'Collar mini corazon=10', 'Collar con dije de honguito=18', 'Collar con dije de pajarito=18'] },
    { name: 'Aretes', cover: 'Aretes moño rosa 2', price: 10, item: 'los aretes', ask: 'pedirlos', items: ['MariCristal=12', 'Aretes azulado=10', 'Aretes azulado2=10', 'Aretes corazon pasion=10', 'Aretes corazon=10', 'Aretes elefante dorado=10', 'Aretes luna=8', 'Aretes moño rosa=10', 'Aretes moño rosa 2=10', 'Aretes perla cuadrada=10', 'Aretes circulares dorada=10', 'Aretes cristal lilas=12', 'Aretes cuadrados=8', 'Aretes de moñito perlado=12', 'Aretes de perla=10', 'Aretes flor=12', 'Aretes tortuga celeste=8', 'Aretes tortuga negro=8', 'Aretes libelula=12', 'Aretes piedra celeste=8', 'Aretes circulo celeste=8', 'Aretes circular verdes=8', 'Aretes corazon piedritas negras=10', 'Aretes flor celeste=15', 'Aretes flor crema=15', 'Aretes flor plateada=15', 'Aretes flor dorada=15', 'Aretes corazon mini plateado=10', 'Aretes piedra color esmeralda=12', 'Aretes perla colgante=12', 'Aretes de corazon tejido=8'] },
    { name: 'Pulseras', cover: 'Pulsera trebol marino', price: 18, item: 'la pulsera', ask: 'pedirla', items: ['Pulsera dijes de mar=15', 'Pulsera trebol marino=15', 'Pulsera de bolitas doradas=8', 'Pulsera de corazones=8', 'Pulsera de MAMA=8', 'Pulsera sencilla azul=8', 'Pulsera tejida con bolitas=12', 'Pulsera treanzada=12'] },
    { name: 'Sets', cover: 'Set concha de caracol', price: 28, item: 'el set', ask: 'pedirlo', items: ['Set azul=12', 'Set concha de caracol=20', 'Set dijes de mar=25', 'Set flor dorada SOLD OUT', 'Set perlado=20', 'Collar concha y perla=20', 'Collar mar-caracol=20', 'Set corazon rojo=18', 'Set circular dorado=20', 'Set conchitas de mar=20', 'Set hoja dorada=18', 'Set flor esmeralda=18', 'Set tejido virgen=28', 'Set piedras y cruz=25', 'Set petalos de cristal=20', 'Set petalos de cristal2=20', 'Set cadena con dije de virgen=25', 'Set corazon oscuro=18', 'Set de mariposa=20'] },
    { name: 'Plata 925', cover: 'Set de corazon-plata 925', price: 40, material: 'Plata 925', item: 'la pieza', ask: 'pedirla', items: ['Set de corazon-plata 925=58', 'Pulsera cristal=28', 'Set flor azul=68', 'Set cristal rosa=58', 'Set cristal blanco=58', 'Set de flor trebol=58', 'Set doble corazon=58', 'Set doble cristal rojo=58', 'Set circulo corazon=48', 'Set estrella de mar=58', 'Pulsera estilo cadenitas=28', 'Pulsera corazon=18'] },
];

const SOLD_RE = /\s*SOLD OUT$/i;

const products = CATEGORIES.flatMap(c => [...c.items].reverse().map(file => {
    const [base, own] = file.split('=');
    const name = base.replace(SOLD_RE, '');
    return {
        name,
        category: c.name,
        price: own ? parseFloat(own) : c.price,
        material: c.material || DEFAULT_MATERIAL,
        sold: SOLD_RE.test(base),
        img: `Imagenes/web/${c.name}/${base}.jpg`,
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
                <p class="material">${p.material}</p>
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
    $('lightboxMaterial').textContent = p.material;
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
