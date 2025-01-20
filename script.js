// Smooth scroll için
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Navbar scroll efekti düzeltmesi
window.addEventListener('scroll', function() {
    const header = document.querySelector('.main-header');
    if (window.scrollY > 50) {
        header.style.background = 'rgba(43, 43, 43, 0.95)';
    } else {
        header.style.background = 'var(--nav-bg)';
    }
});

// Sayı animasyonu düzeltmesi
function animateNumbers() {
    const numbers = document.querySelectorAll('.stat-number');
    
    numbers.forEach(number => {
        const target = parseFloat(number.textContent);
        let current = 0;
        const increment = target / 100; // Daha yumuşak animasyon
        const duration = 2000; // 2 saniye
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            current = progress * target;
            number.textContent = current.toFixed(target % 1 === 0 ? 0 : 1);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    });
}

// Intersection Observer düzeltmesi
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            if (entry.target.classList.contains('stats')) {
                animateNumbers();
            }
            observer.unobserve(entry.target); // Bir kez çalıştıktan sonra gözlemi durdur
        }
    });
}, { 
    threshold: 0.2,
    rootMargin: '0px'
});

document.querySelectorAll('.tech-item, .stats, .hero-text').forEach(el => {
    observer.observe(el);
});

// Kod yazma animasyonu düzeltmesi
function startTypingAnimation() {
    const codeElement = document.querySelector('.code-content code');
    const text = codeElement.textContent;
    codeElement.textContent = '';
    let i = 0;

    function typeChar() {
        if (i < text.length) {
            codeElement.textContent += text.charAt(i);
            i++;
            setTimeout(typeChar, 50);
        }
    }

    typeChar();
}

// Sayfa yüklendiğinde animasyonu başlat
document.addEventListener('DOMContentLoaded', () => {
    startTypingAnimation();
}); 