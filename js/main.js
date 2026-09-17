document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            // For a simple toggle, we can use flex/none
            const isShowing = navLinks.style.display === 'flex';
            if (isShowing) {
                navLinks.style.display = 'none';
            } else {
                navLinks.style.display = 'flex';
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '100%';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                navLinks.style.backdropFilter = 'blur(10px)';
                navLinks.style.padding = '1rem';
                navLinks.style.borderBottom = '1px solid var(--color-border)';
            }
        });

        // Close menu when clicking a link (on mobile)
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 992) {
                    navLinks.style.display = 'none';
                }
            });
        });

        // Reset inline styles on resize if moving to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992) {
                navLinks.style.display = '';
                navLinks.style.flexDirection = '';
                navLinks.style.position = '';
                navLinks.style.top = '';
                navLinks.style.left = '';
                navLinks.style.width = '';
                navLinks.style.backgroundColor = '';
                navLinks.style.backdropFilter = '';
                navLinks.style.padding = '';
                navLinks.style.borderBottom = '';
            } else {
                navLinks.style.display = 'none';
            }
        });
    }

    // 2. Add to Cart Logic & Toast
    const addBtns = document.querySelectorAll('.quick-add-btn');
    const cartCountEl = document.querySelector('.cart-count');
    const toast = document.getElementById('toast');
    let cartCount = 0;
    let toastTimeout;

    addBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productName = e.target.getAttribute('data-name');
            
            // Increment cart
            cartCount++;
            cartCountEl.textContent = cartCount;
            
            // Animate cart badge
            cartCountEl.style.transform = 'scale(1.2)';
            setTimeout(() => {
                cartCountEl.style.transform = 'scale(1)';
            }, 200);

            // Show Toast
            toast.textContent = `¡${productName} añadido al carrito!`;
            toast.classList.add('show');

            // Hide Toast after 3 seconds
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        });
    });
});
