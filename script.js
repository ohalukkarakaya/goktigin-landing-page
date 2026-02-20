const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const anchors = document.querySelectorAll('a[href^="#"]');

anchors.forEach(anchor => {
    anchor.addEventListener('click', event => {
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') {
            return;
        }

        const target = document.querySelector(targetId);
        if (!target) {
            return;
        }

        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
});

const revealItems = document.querySelectorAll('[data-reveal]');

revealItems.forEach(item => {
    const delay = item.getAttribute('data-delay');
    if (delay) {
        item.style.setProperty('--delay', delay);
    }
});

if (prefersReducedMotion) {
    revealItems.forEach(item => item.classList.add('is-visible'));
} else {
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -10% 0px'
        }
    );

    revealItems.forEach(item => observer.observe(item));
}
