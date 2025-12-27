export function initCollapsibles(): void {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const collapsible = header.parentElement;
            if (collapsible) {
                collapsible.classList.toggle('open');
            }
        });
    });
}

export function initCredenceAnimation(): void {
    const dashboard = document.querySelector('.credence-dashboard');
    if (!dashboard) return;

    const bars = document.querySelectorAll('.credence-bar');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                bars.forEach(bar => bar.classList.add('animated'));
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(dashboard);
}
