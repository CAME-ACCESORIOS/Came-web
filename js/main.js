const WHATSAPP = '50762721611';

// Para agregar una pieza: sumar su nombre a la categoría (la foto va en Imagenes/web/<Categoría>/<Nombre>.jpg)
const CATEGORIES = [
    { name: 'Collares', price: 20, item: 'el collar', ask: 'pedirlo', items: ['Ave-cora', 'Corazon dorado', 'Flor mari'] },
    { name: 'Aretes', price: 10, item: 'los aretes', ask: 'pedirlos', items: ['Aroma cafe', 'Candongas variadas', 'Cora perlado', 'Flor perla', 'Piramide de perla', 'Rojo de lotto'] },
    { name: 'Pulseras', price: 18, item: 'la pulsera', ask: 'pedirla', items: ['Corazon de esperanza', 'Mar como la estrella', 'Un solo mar'] },
    { name: 'Sets', price: 28, item: 'el set', ask: 'pedirlo', items: ['Corazon brillante', 'Dorado geometrico'] },
];

const products = CATEGORIES.flatMap(c => c.items.map(name => ({
    name,
    category: c.name,
    price: c.price,
    img: `Imagenes/web/${c.name}/${name}.jpg`,
    wa: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, me encantó ${c.item} ${name} y quiero ${c.ask}`)}`,
})));

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
        <article class="product-card">
            <button class="product-img-wrapper" data-index="${products.indexOf(p)}" aria-label="Ver ${p.name} en grande">
                <img src="${p.img}" alt="${p.category}: ${p.name}" loading="lazy">
                <span class="glare" aria-hidden="true"></span>
            </button>
            <div class="product-info">
                <h4>${p.name}</h4>
                <p class="price">${formatPrice(p.price)}</p>
                <a class="buy-link" href="${p.wa}" target="_blank" rel="noopener">Pedir por WhatsApp</a>
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
    $('lightboxPrice').textContent = formatPrice(p.price);
    $('lightboxBuy').href = p.wa;
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
