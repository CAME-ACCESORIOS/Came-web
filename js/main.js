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

function renderProducts(filter = 'all') {
    const list = filter === 'all' ? products : products.filter(p => p.category === filter);
    $('catalogTitle').textContent = filter === 'all' ? 'Todas las piezas' : filter;
    $('showAll').hidden = filter === 'all';
    $('productGrid').innerHTML = list.map(p => `
        <article class="product-card">
            <button class="product-img-wrapper" data-index="${products.indexOf(p)}" aria-label="Ver ${p.name} en grande">
                <img src="${p.img}" alt="${p.category}: ${p.name}" loading="lazy">
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

function openLightbox(p) {
    $('lightboxImg').src = p.img;
    $('lightboxImg').alt = `${p.category}: ${p.name}`;
    $('lightboxName').textContent = p.name;
    $('lightboxPrice').textContent = formatPrice(p.price);
    $('lightboxBuy').href = p.wa;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
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
        if (e.target === lightbox || e.target.closest('#lightboxClose')) closeLightbox();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });

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
