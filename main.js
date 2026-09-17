/* =============================================================================
   Adrian & Celeste — interaction and motion controller
   No dependencies. Every effect degrades gracefully without JS.
   ============================================================================= */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var WEDDING = new Date("2026-10-16T14:30:00+02:00");

  /* ---------------------------------------------------------------------------
     Petals: drifting rose petals in the ambient layer
     --------------------------------------------------------------------------- */
  function seedPetals() {
    var host = document.getElementById("petals");
    if (!host || reduced) return;
    var count = window.innerWidth < 700 ? 10 : 18;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var p = document.createElement("span");
      p.className = "petal";
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.setProperty("--w", (7 + Math.random() * 11).toFixed(1) + "px");
      p.style.setProperty("--x", (Math.random() * 220 - 110).toFixed(0) + "px");
      p.style.setProperty("--t", (13 + Math.random() * 16).toFixed(1) + "s");
      p.style.setProperty("--delay", (-Math.random() * 22).toFixed(1) + "s");
      p.style.setProperty("--o", (0.25 + Math.random() * 0.4).toFixed(2));
      frag.appendChild(p);
    }
    host.appendChild(frag);
  }

  /* ---------------------------------------------------------------------------
     Split headline text into per-character spans with staggered delays
     --------------------------------------------------------------------------- */
  function splitText(el, base, step, tracked) {
    var text = el.textContent;
    el.textContent = "";
    el.setAttribute("aria-label", text);
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement("span");
      span.className = tracked ? "ch ch--trk" : "ch";
      span.setAttribute("aria-hidden", "true");
      span.textContent = text[i];
      span.style.setProperty("--cd", (base + i * step).toFixed(3) + "s");
      el.appendChild(span);
    }
  }

  function prepareHeroType() {
    var eyebrow = document.querySelector("[data-letters]");
    if (eyebrow) splitText(eyebrow, 0.85, 0.028, true);
    var names = document.querySelectorAll("[data-letters-script]");
    for (var i = 0; i < names.length; i++) {
      splitText(names[i], 1.15 + i * 0.55, 0.062, false);
    }
  }

  /* ---------------------------------------------------------------------------
     The gate: envelope opens, curtains part, columns slide in
     --------------------------------------------------------------------------- */
  function openGate() {
    var gate = document.getElementById("gate");
    if (!gate || gate.classList.contains("is-opening")) return;

    gate.classList.add("is-opening");

    // The paper tears away first, then the stage takes over.
    window.setTimeout(
      function () {
        gate.classList.add("is-done");
        document.body.classList.remove("is-sealed");
        document.body.classList.add("is-open");
        window.scrollTo(0, 0);
      },
      reduced ? 60 : 1150,
    );

    // Once the curtains have finished travelling, retire the stage layer so it
    // stops sitting over the page and swallowing pointer events.
    window.setTimeout(
      function () {
        document.body.classList.add("stage-retired");
        var stage = document.getElementById("stage");
        if (stage) stage.style.display = "none";
      },
      reduced ? 200 : 4400,
    );
  }

  function wireGate() {
    var seal = document.getElementById("seal");
    var gate = document.getElementById("gate");
    if (!seal || !gate) return;
    seal.addEventListener("click", openGate);
    gate.addEventListener("click", function (e) {
      if (e.target !== seal) openGate();
    });
    document.addEventListener("keydown", function (e) {
      if (
        document.body.classList.contains("is-sealed") &&
        (e.key === "Enter" || e.key === " ")
      ) {
        e.preventDefault();
        openGate();
      }
    });
  }

  /* ---------------------------------------------------------------------------
     Scroll reveals

     Driven by geometry rather than IntersectionObserver. An earlier version
     observed the elements directly, which deadlocked the `wipe` variant: its
     resting state is clip-path: inset(0 0 100% 0), Chrome folds an element's
     own clip into its intersection rectangle, so a clipped element reports
     zero intersection and never earns the class that would unclip it.
     Measuring the layout box sidesteps that entirely, and it degrades to
     "everything visible" if anything here throws.
     --------------------------------------------------------------------------- */
  var revealQueue = [];

  function revealPass() {
    if (!revealQueue.length) return;
    var vh = window.innerHeight;
    var still = [];
    for (var i = 0; i < revealQueue.length; i++) {
      var el = revealQueue[i];
      var r = el.getBoundingClientRect();
      // visible once its top edge has risen above 88% of the viewport, or if
      // it straddles the viewport entirely (taller than the screen)
      if (r.top < vh * 0.88 && r.bottom > 0) {
        el.classList.add("in");
      } else {
        still.push(el);
      }
    }
    revealQueue = still;
  }

  function wireReveals() {
    var items = document.querySelectorAll("[data-reveal]");
    for (var i = 0; i < items.length; i++) revealQueue.push(items[i]);
    revealPass();
  }

  /* ---------------------------------------------------------------------------
     Countdown, with a roll animation on each digit change
     --------------------------------------------------------------------------- */
  function wireCountdown() {
    var fields = {};
    var nodes = document.querySelectorAll("[data-unit]");
    if (!nodes.length) return;
    for (var i = 0; i < nodes.length; i++)
      fields[nodes[i].dataset.unit] = nodes[i];

    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }

    function tick() {
      var diff = Math.max(0, WEDDING.getTime() - Date.now());
      var s = Math.floor(diff / 1000);
      var next = {
        days: pad(Math.floor(s / 86400)),
        hours: pad(Math.floor((s % 86400) / 3600)),
        minutes: pad(Math.floor((s % 3600) / 60)),
        seconds: pad(s % 60),
      };
      Object.keys(next).forEach(function (key) {
        var el = fields[key];
        if (!el || el.textContent === next[key]) return;
        el.textContent = next[key];
        if (reduced) return;
        el.classList.remove("tick");
        void el.offsetWidth; // restart the animation
        el.classList.add("tick");
      });
    }

    tick();
    window.setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------------------------
     Parallax + timeline draw, driven by one rAF-throttled scroll loop
     --------------------------------------------------------------------------- */
  function wireScrollMotion() {
    var layers = Array.prototype.slice.call(
      document.querySelectorAll("[data-parallax]"),
    );
    var timeline = document.getElementById("timeline");
    var fill = document.getElementById("timelineFill");
    var queued = false;

    function frame() {
      queued = false;
      var vh = window.innerHeight;

      revealPass();
      if (reduced) return;

      layers.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        var depth = parseFloat(el.dataset.parallax) || 0.1;
        var offset = (rect.top + rect.height / 2 - vh / 2) * depth;
        el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
      });

      if (timeline && fill) {
        var r = timeline.getBoundingClientRect();
        var progress = (vh * 0.72 - r.top) / r.height;
        progress = Math.min(1, Math.max(0, progress));
        fill.style.scale = "1 " + progress.toFixed(3);
      }
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(frame);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  }

  /* ---------------------------------------------------------------------------
     RSVP form
     --------------------------------------------------------------------------- */
  function wireForm() {
    var form = document.getElementById("rsvpForm");
    if (!form) return;

    var conditional = document.getElementById("ifYes");
    var errorBox = document.getElementById("formError");
    var thanks = document.getElementById("thanks");
    var thanksNote = document.getElementById("thanksNote");
    var counter = document.getElementById("guestCount");
    var guests = 1;

    function setConditional() {
      var yes = form.querySelector('input[name="attending"][value="yes"]');
      conditional.classList.toggle("open", !!(yes && yes.checked));
    }

    form.addEventListener("change", function (e) {
      if (e.target.name === "attending") {
        setConditional();
        errorBox.hidden = true;
      }
    });

    form.addEventListener("click", function (e) {
      var btn = e.target.closest(".stepper__btn");
      if (!btn) return;
      guests = Math.min(12, Math.max(1, guests + Number(btn.dataset.step)));
      counter.textContent = String(guests);
      if (reduced) return;
      counter.classList.remove("tick");
      void counter.offsetWidth;
      counter.classList.add("tick");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var attending = form.querySelector('input[name="attending"]:checked');

      if (!attending) {
        errorBox.textContent = "Please let us know whether you can join us.";
        errorBox.hidden = false;
        return;
      }
      if (
        attending.value === "yes" &&
        !form.querySelector('input[name="events"]:checked')
      ) {
        errorBox.textContent = "Please choose at least one event to attend.";
        errorBox.hidden = false;
        return;
      }

      errorBox.hidden = true;
      thanksNote.textContent =
        attending.value === "yes"
          ? "We cannot wait to celebrate with you. Details will follow by email."
          : "We will miss you, and we are grateful you told us.";

      form.style.transition =
        "opacity .5s ease, transform .6s cubic-bezier(.22,1,.36,1)";
      form.style.opacity = "0";
      form.style.transform = "translateY(-14px)";
      window.setTimeout(
        function () {
          form.hidden = true;
          thanks.hidden = false;
        },
        reduced ? 20 : 480,
      );

      // A real deployment posts here. Left deliberately local.
      // fetch('/api/rsvp', { method: 'POST', body: new FormData(form) });
    });

    setConditional();
  }

  /* ---------------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------------- */
  seedPetals();
  prepareHeroType();
  wireGate();
  wireReveals();
  if (reduced) revealQueue = [];
  wireCountdown();
  wireScrollMotion();
  wireForm();
})();
