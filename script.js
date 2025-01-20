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
        const duration = 2000;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            current = progress * target;
            if (target % 1 === 0) {
                number.textContent = Math.round(current) + (number.textContent.includes('+') ? '+' : '');
            } else {
                number.textContent = current.toFixed(1);
            }
            
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
    const mainCodeElement = document.querySelector('.main-window .code-content code');
    if (!mainCodeElement) return;

    const originalText = mainCodeElement.textContent.trim();
    const lines = originalText.split('\n');
    const emptyLines = Array(lines.length).fill('').join('\n');
    mainCodeElement.textContent = emptyLines;
    
    let i = 0;
    function typeChar() {
        if (i < originalText.length) {
            const currentText = originalText.substring(0, i + 1);
            mainCodeElement.textContent = currentText + 
                '\n'.repeat(lines.length - currentText.split('\n').length);
            i++;
            requestAnimationFrame(() => {
                setTimeout(typeChar, 50);
                Prism.highlightElement(mainCodeElement);
            });
        }
    }
    
    // Ana pencere animasyonunu başlat
    setTimeout(typeChar, 800);
}

// Sayfa yüklendiğinde animasyonu başlat
document.addEventListener('DOMContentLoaded', () => {
    startTypingAnimation();
    document.querySelectorAll('.tech-item, .stats, .hero-text').forEach(el => {
        observer.observe(el);
    });
}); 