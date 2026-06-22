const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");

document.documentElement.classList.add("js");

const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

let headerTicking = false;
setHeaderState();
window.addEventListener(
  "scroll",
  () => {
    if (headerTicking) return;
    headerTicking = true;
    requestAnimationFrame(() => {
      setHeaderState();
      headerTicking = false;
    });
  },
  { passive: true }
);

const closeNav = () => {
  nav?.classList.remove("is-open");
  header?.classList.remove("menu-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  if (!nav || !header) return;
  const isOpen = nav.classList.toggle("is-open");
  header.classList.toggle("menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeNav);
});

document.addEventListener("click", (event) => {
  if (!nav?.classList.contains("is-open")) return;
  if (header?.contains(event.target)) return;
  closeNav();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNav();
  }
});

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.14 }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

window.setTimeout(() => {
  document.querySelectorAll(".reveal:not(.is-visible)").forEach((element) => {
    element.classList.add("is-visible");
  });
}, 900);

if ("IntersectionObserver" in window) {
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const element = entry.target;
        const target = Number(element.dataset.count);
        const suffix = element.dataset.suffix || "";
        const start = performance.now();
        const duration = 900;

        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          element.textContent = `${Math.round(target * eased)}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        };

        requestAnimationFrame(tick);
        countObserver.unobserve(element);
      });
    },
    { threshold: 0.7 }
  );

document.querySelectorAll("[data-count]").forEach((element) => countObserver.observe(element));
}

const galleryItems = Array.from(document.querySelectorAll("[data-gallery-image]"));
const galleryLightbox = document.querySelector("[data-gallery-lightbox]");
const galleryLightboxImage = document.querySelector("[data-gallery-lightbox-image]");
const galleryLightboxTitle = document.querySelector("[data-gallery-lightbox-title]");
const galleryClose = document.querySelector("[data-gallery-close]");
const galleryPrev = document.querySelector("[data-gallery-prev]");
const galleryNext = document.querySelector("[data-gallery-next]");
let galleryIndex = 0;

const setGalleryImage = (index) => {
  if (!galleryItems.length || !galleryLightboxImage || !galleryLightboxTitle) return;

  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  galleryLightboxImage.src = item.dataset.galleryImage;
  galleryLightboxImage.alt = item.dataset.galleryTitle || "";
  galleryLightboxTitle.textContent = item.dataset.galleryTitle || "";
};

const openGallery = (index) => {
  if (!galleryLightbox) return;
  setGalleryImage(index);
  galleryLightbox.classList.add("is-open");
  galleryLightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeGallery = () => {
  if (!galleryLightbox) return;
  galleryLightbox.classList.remove("is-open");
  galleryLightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

galleryItems.forEach((item, index) => {
  const image = item.querySelector("img");

  image?.addEventListener("error", () => {
    item.classList.add("is-missing");
  });

  image?.addEventListener("load", () => {
    item.classList.remove("is-missing");
  });

  if (image?.complete && image.naturalWidth === 0) {
    item.classList.add("is-missing");
  }

  item.addEventListener("click", () => {
    if (item.classList.contains("is-missing")) return;
    openGallery(index);
  });
});

galleryClose?.addEventListener("click", closeGallery);
galleryPrev?.addEventListener("click", () => setGalleryImage(galleryIndex - 1));
galleryNext?.addEventListener("click", () => setGalleryImage(galleryIndex + 1));

galleryLightbox?.addEventListener("click", (event) => {
  if (event.target === galleryLightbox) {
    closeGallery();
  }
});

document.addEventListener("keydown", (event) => {
  if (!galleryLightbox?.classList.contains("is-open")) return;

  if (event.key === "Escape") closeGallery();
  if (event.key === "ArrowLeft") setGalleryImage(galleryIndex - 1);
  if (event.key === "ArrowRight") setGalleryImage(galleryIndex + 1);
});

const contactForm = document.querySelector("[data-contact-form]");
const contactStatus = contactForm?.querySelector("[data-form-status]");
const contactStartedAt = contactForm?.querySelector("[data-form-started-at]");
const minSubmitDelay = 4500;
const submitThrottle = 30000;

if (contactForm && contactStatus && contactStartedAt) {
  const loadedAt = Date.now();
  contactStartedAt.value = String(loadedAt);

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const now = Date.now();
    const lastSubmit = Number(sessionStorage.getItem("contactFormLastSubmit") || 0);
    const submitButton = contactForm.querySelector("button[type='submit']");

    contactStatus.classList.remove("is-error", "is-success");

    if (now - loadedAt < minSubmitDelay) {
      contactStatus.textContent = "Bitte warten Sie kurz und senden Sie die Anfrage erneut.";
      contactStatus.classList.add("is-error");
      return;
    }

    if (now - lastSubmit < submitThrottle) {
      contactStatus.textContent = "Bitte warten Sie einen Moment, bevor Sie erneut senden.";
      contactStatus.classList.add("is-error");
      return;
    }

    submitButton?.setAttribute("disabled", "disabled");
    contactStatus.textContent = "Anfrage wird gesendet...";

    try {
      const payload = new URLSearchParams(new FormData(contactForm));
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: payload,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
      });

      if (!response.ok) {
        throw new Error("Submit failed");
      }

      sessionStorage.setItem("contactFormLastSubmit", String(now));
      contactForm.reset();
      contactStartedAt.value = String(Date.now());
      contactStatus.textContent = "Danke, Ihre Anfrage wurde gesendet.";
      contactStatus.classList.add("is-success");
    } catch {
      contactStatus.textContent =
        "Das Formular konnte nicht gesendet werden. Bitte rufen Sie uns direkt an oder nutzen Sie WhatsApp.";
      contactStatus.classList.add("is-error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
}
