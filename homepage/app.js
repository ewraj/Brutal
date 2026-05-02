document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const reveals = document.querySelectorAll('.reveal');
    
    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Once revealed, no need to keep observing
                observer.unobserve(entry.target);
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    reveals.forEach(reveal => {
        revealObserver.observe(reveal);
    });

    // Dynamic Header Background
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(5, 5, 5, 0.95)';
            nav.style.padding = '15px 5%';
        } else {
            nav.style.background = 'rgba(5, 5, 5, 0.8)';
            nav.style.padding = '20px 5%';
        }
    });

    // Add mouse parallax to hero glow
    const hero = document.querySelector('.hero');
    const glow = document.querySelector('.hero-glow');

    if (hero && glow) {
        hero.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            const moveX = (clientX - centerX) / 20;
            const moveY = (clientY - centerY) / 20;
            
            glow.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
});
