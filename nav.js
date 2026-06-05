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

    // ── Sticky Navbar Scroll Effect & Dynamic Theme ─────────────────────
    var navbar = document.querySelector('.navbar');
    if (navbar) {
        // Store if the navbar was default light in the HTML
        var isDefaultLight = navbar.classList.contains('navbar-light');

        var checkScroll = function() {
            var navbarRect = navbar.getBoundingClientRect();
            var navbarBottom = navbarRect.bottom;

            if (window.scrollY > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            // Determine if navbar is over a dark or light section
            var overLight = isDefaultLight;

            if (window.innerWidth <= 768) {
                // On mobile, keep it dark always to ensure visibility and contrast
                overLight = false;
            } else if (!isDefaultLight) {
                // On index page, check overlap with light sections
                var lightSections = document.querySelectorAll('.products-section, .vision-section, .ceo-section, .split-impact-section, .frieze-section, .testimonials-section');
                lightSections.forEach(function(sec) {
                    var rect = sec.getBoundingClientRect();
                    if (rect.top <= navbarBottom && rect.bottom >= 0) {
                        overLight = true;
                    }
                });
            } else {
                // On subpages, if navbar overlaps the dark footer, turn off light theme
                var footer = document.querySelector('.site-footer-new');
                if (footer) {
                    var rect = footer.getBoundingClientRect();
                    if (rect.top <= navbarBottom && rect.bottom >= 0) {
                        overLight = false;
                    }
                }
            }

            if (overLight) {
                navbar.classList.add('navbar-light');
            } else {
                navbar.classList.remove('navbar-light');
            }

            // Swap logo based on navbar theme
            var logoImg = navbar.querySelector('.logo-img');
            if (logoImg) {
                var currentSrc = logoImg.getAttribute('src');
                var targetSrc = navbar.classList.contains('navbar-light') ? 'assets/Logo cycas original.png' : 'assets/lg CYCAS blanc.png';
                if (currentSrc !== targetSrc) {
                    logoImg.src = targetSrc;
                }
            }
        };
        window.addEventListener('scroll', checkScroll);
        checkScroll();
    }

    // ── Safe SessionStorage Helpers ────────────────────
    function safeGetSession(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }
    function safeSetSession(key, val) {
        try {
            sessionStorage.setItem(key, val);
        } catch (e) {}
    }

    // ── Page loader fade out ───────────────────────────
    var loader = document.getElementById('site-loader');
    if (loader) {
        // Tagline typewriter letter-by-letter reveal
        var tagline = document.getElementById('loader-tagline');
        if (tagline && !safeGetSession('cycas_loader_shown')) {
            var text = tagline.textContent.trim();
            tagline.innerHTML = '';
            for (var i = 0; i < text.length; i++) {
                var span = document.createElement('span');
                var char = text[i];
                if (char === ' ') {
                    span.innerHTML = '&nbsp;';
                } else {
                    span.textContent = char;
                }
                span.style.animationDelay = (i * 0.02) + 's';
                tagline.appendChild(span);
            }
        }

        var hideLoader = function() {
            setTimeout(function() {
                loader.classList.add('fade-out');
                safeSetSession('cycas_loader_shown', 'true');
            }, 2200); // 2.2s fixed show time for premium fluid feel
        };
        
        hideLoader(); // Run immediately, do not block on window resources (e.g. large images)
    }

    // ── Hamburger & Mobile Nav Inject ──────────────────
    var btn = document.getElementById('hamburger');
    if (btn) {
        var navContainer = btn.closest('.navbar');
        var links = navContainer ? navContainer.querySelector('.nav-links') : null;

        if (links) {
            // Dynamically inject Contact link into mobile navigation list if not already present
            var hasContact = false;
            links.querySelectorAll('a').forEach(function (a) {
                if (a.getAttribute('href') === 'contact.html') {
                    hasContact = true;
                }
            });
            if (!hasContact) {
                var contactLink = document.createElement('a');
                contactLink.href = 'contact.html';
                contactLink.className = 'nav-mobile-contact';
                contactLink.textContent = 'Contact';
                links.appendChild(contactLink);
            }

            btn.addEventListener('click', function () {
                var open = links.classList.toggle('nav-open');
                btn.classList.toggle('is-open', open);
                btn.setAttribute('aria-expanded', String(open));
                document.body.style.overflow = open ? 'hidden' : '';
            });

            // Add click listeners to all links (including the newly injected contact)
            links.querySelectorAll('a').forEach(function (a) {
                a.addEventListener('click', function () {
                    links.classList.remove('nav-open');
                    btn.classList.remove('is-open');
                    btn.setAttribute('aria-expanded', 'false');
                    document.body.style.overflow = '';
                });
            });

            document.addEventListener('click', function (e) {
                if (navContainer && !navContainer.contains(e.target)) {
                    if (links.classList.contains('nav-open')) {
                        links.classList.remove('nav-open');
                        btn.classList.remove('is-open');
                        btn.setAttribute('aria-expanded', 'false');
                        document.body.style.overflow = '';
                    }
                }
            });
        }
    }
});
