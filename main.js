/* LKS Systems — shared site behaviour */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav shrink on scroll ---------- */
  var nav = document.querySelector(".nav");
  var lastY = window.scrollY;

  function onScroll() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 24);

    var bar = document.querySelector(".progress-bar");
    if (bar) {
      var h = document.documentElement;
      var scrollable = h.scrollHeight - h.clientHeight;
      var pct = scrollable > 0 ? (y / scrollable) * 100 : 0;
      bar.style.width = pct + "%";
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");
  var closeBtn = document.querySelector(".mobile-menu-close");

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add("is-open");
    document.body.style.overflow = "hidden";
    toggle.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove("is-open");
    document.body.style.overflow = "";
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && mobileMenu) {
    toggle.addEventListener("click", openMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- Scroll reveals ---------- */
  var revealEls = document.querySelectorAll(".reveal, .reveal-line");

  function triggerGlitch(el) {
    if (!el.hasAttribute("data-glitch") || reduceMotion) return;
    setTimeout(function () {
      var target = el.querySelector("[data-glitch-target]");
      if (target) target.classList.add("glitching");
    }, 1200);
  }

  if (reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  } else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            triggerGlitch(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });

    /* safety net: force-reveal anything the observer never catches */
    setTimeout(function () {
      revealEls.forEach(function (el) {
        if (!el.classList.contains("in-view")) {
          el.classList.add("in-view");
          triggerGlitch(el);
        }
      });
    }, 2500);
  } else {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- Hero particle field ---------- */
  var particleField = document.getElementById("heroParticles");
  if (particleField && !reduceMotion) {
    var particleColors = ["rgba(110,91,255,.55)", "rgba(168,155,255,.45)", "rgba(244,244,242,.3)"];
    for (var i = 0; i < 16; i++) {
      var p = document.createElement("span");
      p.className = "hero-particle";
      var size = (Math.random() * 2.2 + 1).toFixed(1);
      p.style.left = (Math.random() * 100).toFixed(1) + "%";
      p.style.width = size + "px";
      p.style.height = size + "px";
      p.style.background = particleColors[i % particleColors.length];
      p.style.animationDuration = (7 + Math.random() * 6).toFixed(1) + "s";
      p.style.animationDelay = (Math.random() * 8).toFixed(1) + "s";
      particleField.appendChild(p);
    }
  }

  /* ---------- Custom cursor (desktop, fine pointer only) ---------- */
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover && !reduceMotion) {
    var dot = document.createElement("div");
    dot.className = "cursor-dot";
    document.body.appendChild(dot);

    window.addEventListener("mousemove", function (e) {
      dot.style.left = e.clientX + "px";
      dot.style.top = e.clientY + "px";
    });

    var hoverTargets = document.querySelectorAll("a, button, .card, .work-card");
    hoverTargets.forEach(function (el) {
      el.addEventListener("mouseenter", function () { dot.classList.add("is-hovering"); });
      el.addEventListener("mouseleave", function () { dot.classList.remove("is-hovering"); });
    });
  }

  /* ---------- Magnetic primary buttons ---------- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll(".btn-primary").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + x * 0.18 + "px," + y * 0.35 + "px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "";
      });
    });
  }

  /* ---------- Contact form (Web3Forms, with mailto fallback) ---------- */
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    var cfSubmit = document.getElementById("cfSubmit");
    var cfStatus = document.getElementById("cfStatus");
    var cfSubmitDefaultHTML = cfSubmit ? cfSubmit.innerHTML : "";
    var cfStatusDefaultText = cfStatus ? cfStatus.textContent : "";

    function mailtoFallback() {
      var name = document.getElementById("cf-name").value.trim();
      var email = document.getElementById("cf-email").value.trim();
      var message = document.getElementById("cf-message").value.trim();
      var subject = encodeURIComponent("New project enquiry from " + (name || "website"));
      var body = encodeURIComponent("Name: " + name + "\nEmail: " + email + "\n\n" + message);
      window.location.href = "mailto:customercare@thelouispen.co.uk?subject=" + subject + "&body=" + body;
    }

    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var accessKey = contactForm.querySelector('[name="access_key"]').value;
      if (!accessKey || accessKey.indexOf("REPLACE_WITH") === 0) {
        mailtoFallback();
        return;
      }

      var payload = Object.fromEntries(new FormData(contactForm));

      if (cfSubmit) { cfSubmit.disabled = true; cfSubmit.textContent = "Sending…"; }
      if (cfStatus) { cfStatus.textContent = "Sending your message…"; }

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok && result.data && result.data.success) {
            contactForm.reset();
            if (cfStatus) cfStatus.textContent = "Message sent — thanks, we'll reply within one working day.";
          } else {
            throw new Error("Web3Forms submission failed");
          }
        })
        .catch(function () {
          if (cfStatus) cfStatus.textContent = "Couldn't send automatically — opening your email client instead.";
          mailtoFallback();
        })
        .finally(function () {
          if (cfSubmit) { cfSubmit.disabled = false; cfSubmit.innerHTML = cfSubmitDefaultHTML; }
        });
    });
  }

  /* ---------- Active nav link ---------- */
  function normalizePath(p) {
    p = p.split("#")[0].split("?")[0].replace(/\.html$/, "").replace(/\/index$/, "/");
    if (p !== "/") p = p.replace(/\/$/, "");
    return p || "/";
  }
  var currentPath = normalizePath(location.pathname);
  document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(function (a) {
    if (normalizePath(a.getAttribute("href")) === currentPath) {
      a.classList.add("active");
    }
  });
})();
