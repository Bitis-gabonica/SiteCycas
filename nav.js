document.addEventListener('DOMContentLoaded', function () {
    // ── Cart badge sync ────────────────────────────────
    function syncBadge() {
        var count = 0;
        try {
            var items = JSON.parse(localStorage.getItem('cycas_items') || '[]');
            count = items.reduce(function (a, i) { return a + (i.qty || 0); }, 0);
        } catch (e) {}
        var badge = document.getElementById('cart-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('has-items', count > 0);
        }
    }
    syncBadge();
    window.addEventListener('storage', syncBadge);

    // ── Hamburger ──────────────────────────────────────
    var btn = document.getElementById('hamburger');
    if (!btn) return;
    var navbar = btn.closest('.navbar');
    var links = navbar.querySelector('.nav-links');

    btn.addEventListener('click', function () {
        var open = links.classList.toggle('nav-open');
        btn.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
    });

    links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
            links.classList.remove('nav-open');
            btn.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('click', function (e) {
        if (!navbar.contains(e.target)) {
            links.classList.remove('nav-open');
            btn.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });
});
