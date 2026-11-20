#!/usr/bin/env python3
"""Builds index.html (English), tr/index.html (Turkish) and llms.txt from one template.

Run from the repo root:
    GK_EMAIL=<contact address> python3 tools/build_pages.py
The contact address is read from the environment so it is not stored in this script.
"""
import html
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EMAIL = os.environ.get("GK_EMAIL", "").strip()
if "@" not in EMAIL:
    sys.exit("Set GK_EMAIL to the public contact address, e.g. GK_EMAIL=... python3 tools/build_pages.py")

SITE = "https://goktigin.com"
UPDATED_ISO = "2026-11-20"
V = "29"  # cache-busting version for styles.css and script.js

T = {
  "en": {
    "lang": "en", "locale": "en_US", "path": "/", "other": "tr", "other_path": "/tr/", "other_label": "TR",
    "other_name": "Türkçe",
    "title": "Göktigin: the software studio behind Art of Menu and Chaput",
    "description": "Göktigin is a software studio in Antalya Teknokent, Turkey. We build and run our own products: Art of Menu for restaurants and Chaput, a social app for iOS and Android.",
    "og_title": "Göktigin · Software studio in Antalya",
    "home": "Göktigin home",
    "nav_label": "Sections",
    "nav": ["Products", "Process", "FAQ", "Contact"],
    "status": "Studio status",
    "h1": "We turn code into products people&nbsp;use.",
    "lede": "Göktigin is a software studio in Antalya Teknokent, Turkey. We design, build and run our own products: Art of Menu for restaurants and cafés, and Chaput, a social app for iOS and Android.",
    "cta": "See our products",
    "hint_desktop": "Move your cursor over the characters. Under the lens they turn back into the real screen.",
    "hint_touch": "Touch and drag over the characters. Under the lens they turn back into the real screen.",
    "swipe_hint": "Swipe for the next product · tap the phone to compile it",
    "products_h": "Our products",
    "aom_tag": "New",
    "aom_p": "Art of Menu runs QR menus, table ordering and pricing for restaurants and cafés. Owners manage menus, branches, tables and staff from one web panel, and prices can follow the hour and the weather.",
    "aom_term": ["qr menu · table ordering · waiter calls", "smart pricing · weather &amp; hour targeting", "web panel · menus, branches, staff"],
    "chaput_tag": "iOS · Android",
    "chaput_p": "Chaput is a women-first social app for goths. It isn't a dating app. Every profile is a tree, and men join after three women in the community approve them.",
    "chaput_term": ["profile trees · invites · achievements", "community admission"],
    "benek_tag": "Paused",
    "benek_p": "Benek connects pet owners with sitters they can trust. It is on hold while we focus on Art of Menu and Chaput.",
    "benek_term": "paused · waiting in the branch",
    "process_h": "How we build",
    "steps": [
      ("Research.", "Find the real problem and the smallest product that solves it."),
      ("Design.", "Turn it into screens people understand without a tutorial."),
      ("Build.", "Write fast, stable code for the web, iOS and Android."),
      ("Ship.", "Release to the stores and the web, watch how people use it, then improve it."),
    ],
    "faq_h": "Questions",
    "faq": [
      ("What is Göktigin?",
       "Göktigin (Göktigin Bilişim Teknoloji Ltd. Şti.) is a software studio based in Antalya Teknokent, Turkey. It builds and runs its own products: Art of Menu, a QR menu and table ordering system for restaurants, and Chaput, a social app for iOS and Android."),
      ("What is Art of Menu?",
       "Art of Menu is restaurant software made by Göktigin. Guests scan a QR code at the table to read the menu, order and call a waiter. Owners manage menus, prices, branches, tables and staff from a web panel. Details are at artofmenu.com."),
      ("What is Chaput?",
       "Chaput is a women-first social app for goths, made by Göktigin for iOS and Android. It is not a dating app. Each profile is a tree that others can tie a chaput to, and men join after three women in the community approve them. Details are at chaput.app."),
      ("Where is Göktigin based?",
       "Göktigin is based at Antalya Teknokent, the technology park in Antalya, Turkey."),
      ("How do I contact Göktigin?",
       "Write to {EMAIL}. We reply by email."),
    ],
    "contact_h": "Say hello.",
    "contact_p": "Write to us about anything. We reply by email.",
    "addr": "Antalya Teknokent, Antalya, Turkey",
    "updated": "Last updated 20 November 2026",
    "rights": "© 2026 Göktigin Bilişim Teknoloji Ltd. Şti.",
    "motto_en": "Love of country is measured by service to it.",
  },
  "tr": {
    "lang": "tr", "locale": "tr_TR", "path": "/tr/", "other": "en", "other_path": "/", "other_label": "EN",
    "other_name": "English",
    "title": "Göktigin: Art of Menu ve Chaput'u geliştiren yazılım stüdyosu",
    "description": "Göktigin, Antalya Teknokent'te bir yazılım stüdyosu. Kendi ürünlerimizi geliştirip işletiyoruz: restoranlar için Art of Menu ve iOS ile Android'de sosyal uygulama Chaput.",
    "og_title": "Göktigin · Antalya'da yazılım stüdyosu",
    "home": "Göktigin ana sayfa",
    "nav_label": "Bölümler",
    "nav": ["Ürünler", "Süreç", "SSS", "İletişim"],
    "status": "Stüdyo durumu",
    "h1": "Kodu, insanların kullandığı ürünlere dönüştürüyoruz.",
    "lede": "Göktigin, Antalya Teknokent'te bir yazılım stüdyosu. Kendi ürünlerimizi tasarlıyor, geliştiriyor ve işletiyoruz: restoran ve kafeler için Art of Menu, iOS ve Android için sosyal uygulama Chaput.",
    "cta": "Ürünlerimiz",
    "hint_desktop": "İmleci karakterlerin üzerinde gezdirin. Merceğin altında gerçek ekran görünür.",
    "hint_touch": "Karakterlere dokunup sürükleyin. Merceğin altında gerçek ekran görünür.",
    "swipe_hint": "Diğer ürün için kaydır · derlemek için telefona dokun",
    "products_h": "Ürünlerimiz",
    "aom_tag": "Yeni",
    "aom_p": "Art of Menu, restoran ve kafeler için QR menü, masadan sipariş ve fiyatlandırma sistemi. İşletme sahibi menüleri, şubeleri, masaları ve çalışanları tek bir web panelinden yönetir. Fiyatlar saate ve havaya göre değişebilir.",
    "aom_term": ["qr menü · masadan sipariş · garson çağırma", "akıllı fiyat · saate ve havaya göre", "web panel · menü, şube, ekip"],
    "chaput_tag": "iOS · Android",
    "chaput_p": "Chaput, gotikler için kadın öncelikli bir sosyal uygulama. Flört uygulaması değil. Her profil bir ağaç; erkekler, topluluktaki üç kadın profillerini onayladıktan sonra katılabiliyor.",
    "chaput_term": ["profil ağaçları · davetler · başarımlar", "topluluk onayıyla katılım"],
    "benek_tag": "Beklemede",
    "benek_p": "Benek, evcil hayvan sahiplerini güvenebilecekleri bakıcılarla buluşturuyor. Art of Menu ve Chaput'a odaklandığımız için şimdilik beklemede.",
    "benek_term": "beklemede · dalda duruyor",
    "process_h": "Nasıl çalışıyoruz",
    "steps": [
      ("Araştırma.", "Asıl sorunu ve onu çözen en küçük ürünü bulmak."),
      ("Tasarım.", "Bunu, öğretici gerektirmeden anlaşılan ekranlara dönüştürmek."),
      ("Geliştirme.", "Web, iOS ve Android için hızlı ve sağlam kod yazmak."),
      ("Yayın.", "Mağazalara ve web'e çıkarmak, insanların nasıl kullandığına bakmak, sonra iyileştirmek."),
    ],
    "faq_h": "Sık sorulanlar",
    "faq": [
      ("Göktigin nedir?",
       "Göktigin (Göktigin Bilişim Teknoloji Ltd. Şti.), Antalya Teknokent'te bulunan bir yazılım stüdyosu. Kendi ürünlerini geliştirip işletiyor: restoranlar için QR menü ve masadan sipariş sistemi Art of Menu ile iOS ve Android'deki sosyal uygulama Chaput."),
      ("Art of Menu nedir?",
       "Art of Menu, Göktigin'in geliştirdiği restoran yazılımı. Misafirler masadaki QR kodu okutarak menüyü görür, sipariş verir ve garson çağırır. İşletme sahibi menüleri, fiyatları, şubeleri, masaları ve çalışanları web panelinden yönetir. Ayrıntılar artofmenu.com adresinde."),
      ("Chaput nedir?",
       "Chaput, Göktigin'in iOS ve Android için geliştirdiği, gotikler için kadın öncelikli bir sosyal uygulama. Flört uygulaması değil. Her profil, başkalarının çaput bağlayabildiği bir ağaç; erkekler topluluktaki üç kadının onayıyla katılıyor. Ayrıntılar chaput.app adresinde."),
      ("Göktigin nerede?",
       "Göktigin, Antalya'daki teknoloji parkı Antalya Teknokent'te bulunuyor."),
      ("Göktigin'e nasıl ulaşırım?",
       "{EMAIL} adresine yazabilirsiniz. E-postayla dönüş yapıyoruz."),
    ],
    "contact_h": "Bize yazın.",
    "contact_p": "Her konuda yazabilirsiniz. E-postayla dönüş yapıyoruz.",
    "addr": "Antalya Teknokent, Antalya, Türkiye",
    "updated": "Son güncelleme: 20 Kasım 2026",
    "rights": "© 2026 Göktigin Bilişim Teknoloji Ltd. Şti.",
    "motto_en": "",
  },
}

for t in T.values():
    t["faq"] = [(q, a.replace("{EMAIL}", EMAIL)) for q, a in t["faq"]]


def jsonld(t):
    url = SITE + t["path"]
    org_id = SITE + "/#org"
    graph = [
        {
            "@type": "Organization", "@id": org_id,
            "name": "Göktigin", "legalName": "Göktigin Bilişim Teknoloji Ltd. Şti.",
            "url": SITE + "/", "logo": SITE + "/assets/icon-512.png", "email": EMAIL,
            "address": {"@type": "PostalAddress", "streetAddress": "Antalya Teknokent",
                        "addressLocality": "Antalya", "addressCountry": "TR"},
            "description": t["description"],
        },
        {
            "@type": "WebSite", "@id": url + "#website", "url": url, "name": "Göktigin",
            "inLanguage": t["lang"], "publisher": {"@id": org_id}, "dateModified": UPDATED_ISO,
        },
        {
            "@type": "SoftwareApplication", "@id": SITE + "/#artofmenu", "name": "Art of Menu",
            "url": "https://artofmenu.com", "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web", "description": t["aom_p"], "publisher": {"@id": org_id},
        },
        {
            "@type": "MobileApplication", "@id": SITE + "/#chaput", "name": "Chaput",
            "url": "https://chaput.app", "applicationCategory": "SocialNetworkingApplication",
            "operatingSystem": "iOS, Android", "description": t["chaput_p"], "publisher": {"@id": org_id},
        },
        {
            "@type": "FAQPage", "@id": url + "#faq", "inLanguage": t["lang"],
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]],
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


REDIRECT = """<script>
    // First visit: open the page in the browser's language. A language picked with the switch wins.
    // Crawlers are never redirected, so both language versions stay indexable.
    (function () {
      try {
        if (/bot|crawl|spider|slurp|mediapartners|lighthouse|headless|preview/i.test(navigator.userAgent)) return;
        var here = document.documentElement.lang;
        var picked = null;
        try { picked = localStorage.getItem('gk-lang'); } catch (e) {}
        var want = picked || (/^tr\\b/i.test(navigator.language || '') ? 'tr' : 'en');
        if (want !== here) location.replace((want === 'tr' ? '/tr/' : '/') + location.hash);
      } catch (e) {}
    })();
  </script>"""


def page(t):
    e = html.escape
    faq_html = "\n".join(
        f'          <div class="qa"><dt>{e(q)}</dt><dd>{e(a)}</dd></div>' for q, a in t["faq"])
    steps = "\n".join(
        f'          <li><code>{h}</code><div><b>{e(a)}</b> {e(b)}</div></li>'
        for h, (a, b) in zip(["a1f3e09", "4c7d21b", "9e02b5a", "d8b6f14"], t["steps"]))
    aom_term = "\n".join(f'<span class="ok">✓</span> {l}' for l in t["aom_term"])
    ch_term = "\n".join(f'<span class="ok">✓</span> {l}' for l in t["chaput_term"])
    url = SITE + t["path"]
    nav = t["nav"]
    mail = e(EMAIL)
    return f"""<!DOCTYPE html>
<html lang="{t['lang']}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  {REDIRECT}
  <title>{e(t['title'])}</title>
  <meta name="description" content="{e(t['description'])}">
  <link rel="canonical" href="{url}">
  <link rel="alternate" hreflang="en" href="{SITE}/">
  <link rel="alternate" hreflang="tr" href="{SITE}/tr/">
  <link rel="alternate" hreflang="x-default" href="{SITE}/">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#0b0a09">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Göktigin">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(t['og_title'])}">
  <meta property="og:description" content="{e(t['description'])}">
  <meta property="og:image" content="{SITE}/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Göktigin">
  <meta property="og:locale" content="{t['locale']}">
  <meta property="og:locale:alternate" content="{'tr_TR' if t['lang'] == 'en' else 'en_US'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(t['og_title'])}">
  <meta name="twitter:description" content="{e(t['description'])}">
  <meta name="twitter:image" content="{SITE}/assets/og.png">

  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <link rel="alternate icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"></noscript>
  <link rel="preload" href="/assets/fonts/QanelasBold.otf" as="font" type="font/otf" crossorigin>
  <link rel="stylesheet" href="/styles.css?v={V}">
  <script type="importmap">
    {{ "imports": {{
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }} }}
  </script>
  <link rel="modulepreload" href="/script.js?v={V}">
  <link rel="modulepreload" href="/data.js">
  <link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js" crossorigin>
  <link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js" crossorigin>
  <script type="application/ld+json">
{jsonld(t)}
  </script>
</head>
<body>
  <canvas id="stage" aria-hidden="true"></canvas>

  <header class="bar">
    <a class="brand" href="#top" aria-label="{e(t['home'])}">
      <img src="/assets/emblem.svg" alt="" width="26" height="27">
      <span>Göktigin</span>
    </a>
    <nav class="links" aria-label="{e(t['nav_label'])}">
      <a href="#products">{nav[0]}</a>
      <a href="#process">{nav[1]}</a>
      <a href="#faq">{nav[2]}</a>
      <a href="#contact">{nav[3]}</a>
    </nav>
    <a class="lang" href="{t['other_path']}" hreflang="{t['other']}" lang="{t['other']}" title="{t['other_name']}"
       onclick="try{{localStorage.setItem('gk-lang','{t['other']}')}}catch(e){{}}">{t['other_label']}</a>
    <div class="flag" aria-label="{e(t['status'])}">
      <i></i><span>ANTALYA <b id="clock">--:--</b></span>
    </div>
  </header>

  <main id="top">
    <section class="panel hero" data-scene="hero">
      <p class="prompt"><span class="dim">~/göktigin $</span> whoami</p>
      <h1>{t['h1']}</h1>
      <p class="lede">{e(t['lede'])}</p>
      <div class="actions">
        <a class="btn btn-solid" href="#products">{e(t['cta'])}</a>
        <a class="btn btn-line" href="mailto:{mail}">{mail}</a>
      </div>
      <p class="hint"><span class="lens-dot"></span><span class="hint-desktop">{e(t['hint_desktop'])}</span><span class="hint-touch">{e(t['hint_touch'])}</span></p>
    </section>

    <div id="products" class="products">
    <div class="slides">
    <h2 class="sr-only">{e(t['products_h'])}</h2>

    <section class="panel build" data-scene="artofmenu" aria-labelledby="p-aom">
      <p class="prompt"><span class="dim">$</span> ls ./products <span class="dim">· 01 / 03</span></p>
      <article class="card">
        <div class="card-head">
          <h3 id="p-aom">Art of Menu</h3>
          <span class="tag tag-hot">{e(t['aom_tag'])}</span>
        </div>
        <p>{e(t['aom_p'])}</p>
        <pre class="term"><span class="dim">$</span> build art-of-menu
{aom_term}
<span class="go">→</span> <a href="https://artofmenu.com" target="_blank" rel="noopener">artofmenu.com</a></pre>
      </article>
    </section>

    <section class="panel build" data-scene="chaput" aria-labelledby="p-chaput">
      <p class="prompt"><span class="dim">$</span> ls ./products <span class="dim">· 02 / 03</span></p>
      <article class="card">
        <div class="card-head">
          <h3 id="p-chaput">Chaput</h3>
          <span class="tag">{e(t['chaput_tag'])}</span>
        </div>
        <p>{e(t['chaput_p'])}</p>
        <pre class="term"><span class="dim">$</span> build chaput --target ios,android
{ch_term}
<span class="go">→</span> <a href="https://chaput.app" target="_blank" rel="noopener">chaput.app</a></pre>
      </article>
    </section>

    <section class="panel build" data-scene="benek" aria-labelledby="p-benek">
      <p class="prompt"><span class="dim">$</span> ls ./products <span class="dim">· 03 / 03</span></p>
      <article class="card">
        <div class="card-head">
          <h3 id="p-benek">Benek</h3>
          <span class="tag tag-mute">{e(t['benek_tag'])}</span>
        </div>
        <p>{e(t['benek_p'])}</p>
        <pre class="term"><span class="dim">$</span> build benek
<span class="warn">‖</span> {e(t['benek_term'])}</pre>
      </article>
    </section>
    </div>
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="swipe-hint">{e(t['swipe_hint'])}</p>
    </div>

    <section id="process" class="panel build" data-scene="emblem">
      <p class="prompt"><span class="dim">$</span> git log --oneline --reverse</p>
      <div class="card">
        <h2>{e(t['process_h'])}</h2>
        <ol class="log">
{steps}
        </ol>
      </div>
    </section>

    <section id="faq" class="panel build" data-scene="emblem">
      <p class="prompt"><span class="dim">$</span> man göktigin</p>
      <div class="card">
        <h2>{e(t['faq_h'])}</h2>
        <dl class="faq">
{faq_html}
        </dl>
      </div>
    </section>

    <section id="contact" class="panel build contact" data-scene="emblem">
      <p class="prompt"><span class="dim">$</span> contact</p>
      <div class="card">
        <h2>{e(t['contact_h'])}</h2>
        <p>{e(t['contact_p'])}</p>
        <a class="mailline" href="mailto:{mail}"><span class="dim">$</span> mail {mail}<span class="caret"></span></a>
        <address class="addr">{e(t['addr'])}</address>
      </div>
    </section>
  <footer class="foot">
    <figure class="motto">
      <blockquote lang="tr"><p>“Yurt sevgisi ona hizmetle ölçülür.”</p>{f'<p class="motto-en" lang="en">{e(t["motto_en"])}</p>' if t["motto_en"] else ''}</blockquote>
      <figcaption><img src="/assets/ataturk-signature.svg" alt="Mustafa Kemal Atatürk" width="92" height="33" loading="lazy"></figcaption>
    </figure>
    <div class="foot-row">
      <span>{e(t['rights'])}</span>
      <span><time datetime="{UPDATED_ISO}">{e(t['updated'])}</time></span>
      <a href="mailto:{mail}">{mail}</a>
    </div>
  </footer>
  </main>
  <nav class="tabbar" aria-label="Sections">
    <i class="tab-pill" aria-hidden="true"></i>
    <a href="#products" data-tab="products"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="3" width="11" height="18" rx="2.6"/><path d="M10.5 6h3"/></svg><span>{nav[0]}</span></a>
    <a href="#process" data-tab="process"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4.5M12 16.5V21"/><circle cx="12" cy="12" r="4.5"/></svg><span>{nav[1]}</span></a>
    <a href="#faq" data-tab="faq"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M12 13h.01M10.2 8.6a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1"/></svg><span>{nav[2]}</span></a>
    <a href="#contact" data-tab="contact"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.4"/><path d="m4.5 7 7.5 6 7.5-6"/></svg><span>{nav[3]}</span></a>
  </nav>


  <script type="module" src="/script.js?v={V}"></script>
</body>
</html>
"""


def llms_txt():
    en = T["en"]
    lines = [
        "# Göktigin",
        "",
        f"> {en['description']}",
        "",
        "Legal name: Göktigin Bilişim Teknoloji Ltd. Şti.",
        "Location: Antalya Teknokent, Antalya, Turkey",
        f"Contact: {EMAIL}",
        f"Last updated: {UPDATED_ISO}",
        "",
        "## Products",
        "",
        f"- [Art of Menu](https://artofmenu.com): {en['aom_p']}",
        f"- [Chaput](https://chaput.app): {en['chaput_p']} Available on iOS and Android.",
        f"- Benek: {en['benek_p']}",
        "",
        "## Pages",
        "",
        f"- [Göktigin (English)]({SITE}/): studio overview, products, process, FAQ and contact",
        f"- [Göktigin (Türkçe)]({SITE}/tr/): the same page in Turkish",
        "",
        "## FAQ",
        "",
    ]
    for q, a in en["faq"]:
        lines += [f"### {q}", "", a, ""]
    return "\n".join(lines)


(ROOT / "index.html").write_text(page(T["en"]), encoding="utf-8")
(ROOT / "tr").mkdir(exist_ok=True)
(ROOT / "tr" / "index.html").write_text(page(T["tr"]), encoding="utf-8")
(ROOT / "llms.txt").write_text(llms_txt(), encoding="utf-8")
print("wrote index.html, tr/index.html, llms.txt")
