/* Activate only after the owner supplies their GA4 web-stream Measurement ID. */
(() => {
  "use strict";
  const MEASUREMENT_ID = "";
  const sponsors = [
  {
    "id": "sovah",
    "name": "Sovah Orthopedics and Sports Medicine Danville",
    "url": "https://www.sovahhealth.com/providers/todd-pierce-7032676"
  },
  {
    "id": "danville-paint",
    "name": "Danville Paint and Supply",
    "url": "https://www.danvillepaintandsupply.com/"
  },
  {
    "id": "buffalo-wild-wings",
    "name": "Buffalo Wild Wings Danville",
    "url": "https://www.buffalowildwings.com/locations/us/va/danville/3415-riverside-drive/sports-bar-493/"
  },
  {
    "id": "firehouse-subs",
    "name": "Firehouse Subs",
    "url": "https://www.firehousesubs.com/locations"
  },
  {
    "id": "brian-jones-motorsports",
    "name": "Brian Jones Motorsports",
    "url": "https://www.brianjonesmotorsports.com/"
  },
  {
    "id": "toasted-yolk",
    "name": "The Toasted Yolk Danville",
    "url": "https://thetoastedyolk.com/locations/danville-va/"
  },
  {
    "id": "dominion-hardware",
    "name": "Dominion Hardware",
    "url": "https://share.google/qud8JZe8GFWMt64Pi"
  },
  {
    "id": "elizabeth-ware",
    "name": "Elizabeth Ware Realtors",
    "url": "https://www.elizabethwarerealtors.com/?utm_source=RADIO&utm_campaign=Tunstall+Football&mdv=3&mpv=99&utm_medium=referral"
  },
  {
    "id": "trey-belcher",
    "name": "Trey Belcher Training",
    "url": "https://www.treybelchertraining.com/"
  }
];
  const redirectId = document.body.dataset.sponsorRedirect;
  const active = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID) &&
    location.hostname === "ths-fb.github.io";

  if (active) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      send_page_view: !redirectId,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname
    });
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    document.head.appendChild(tag);
  }

  function identify(href) {
    let url;
    try { url = new URL(href, location.href); } catch (_) { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    return sponsors.find((sponsor) => {
      const target = new URL(sponsor.url);
      const sameHost = url.hostname.replace(/^www\./, "") === target.hostname.replace(/^www\./, "");
      // Shared Google links must match the specific business, not all Google links.
      return sameHost && (target.hostname !== "share.google" || url.pathname === target.pathname);
    });
  }

  function record(sponsor, details, callback) {
    if (!active) { if (callback) callback(); return; }
    window.gtag("event", "sponsor_click", {
      sponsor_id: sponsor.id,
      sponsor_name: sponsor.name,
      source_page: location.pathname,
      ...details,
      ...(callback ? { event_callback: callback, event_timeout: 1000 } : {})
    });
  }

  // Dedicated links can later be embedded in downloadable PDFs and printed QR codes.
  // Count here only; never also count the preceding click to this internal URL.
  if (redirectId) {
    const sponsor = sponsors.find((item) => item.id === redirectId);
    if (!sponsor) return;
    let redirected = false;
    const finish = () => {
      if (redirected) return;
      redirected = true;
      location.replace(sponsor.url);
    };
    const from = new URLSearchParams(location.search).get("from");
    const placement = ["pdf", "qr", "website"].includes(from) ? from : "shared_link";
    setTimeout(finish, 1200); // Navigation still works when analytics is blocked.
    record(sponsor, { placement }, finish);
    return;
  }

  function onClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    const sponsor = identify(link.href);
    if (!sponsor) return;
    const pdfPage = link.closest(".flip-page");
    const details = { placement: pdfPage ? "online_program" : "website" };
    if (pdfPage) details.program_page = pdfPage.dataset.pageNumber;
    const sameTab = (!link.target || link.target === "_self") && !event.ctrlKey &&
      !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && !link.hasAttribute("download");
    if (active && sameTab && !event.defaultPrevented) {
      event.preventDefault();
      let navigated = false;
      const finish = () => { if (!navigated) { navigated = true; location.assign(link.href); } };
      setTimeout(finish, 1200);
      record(sponsor, details, finish);
    } else {
      record(sponsor, details);
    }
  }
  document.addEventListener("click", onClick);
  document.addEventListener("auxclick", onClick);
})();
