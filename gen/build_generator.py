"""Build site/generator.html (the app itself is rendered by assets/js/generator.js from assets/data/generator.json).

Run:  python -I gen/build_generator.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import build_page, SITE  # noqa: E402

data = json.loads((SITE / 'assets' / 'data' / 'generator.json').read_text(encoding='utf-8'))
n_models = len(data['models'])
n_opts = sum(len(s['options']) for m in data['models'] for s in m['specs'])
ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg>'

main = f'''<main>
<section class="page-hero gen-hero">
  <div class="gen-grid-bg" aria-hidden="true"></div>
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="products.html">Products</a><span>/</span><b>Code generator</b></nav>
    <span class="eyebrow reveal">Product code generator</span>
    <h1 data-split>Build your <em>ordering code.</em></h1>
    <p class="lede reveal">Pick a model, choose its options and get the exact NeoWave ordering code, ready to copy, share or send for a quote. Already have a code? Paste it below to decode it.</p>
    <form class="decode reveal" id="decodeForm" autocomplete="off">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M8 12h8"/></svg>
      <input id="decodeInput" placeholder="Paste a code, e.g. TxTH29-W-3-V10-V10-1-1" aria-label="Product code to decode" spellcheck="false">
      <button class="btn btn-primary" type="submit">Decode {ARROW}</button>
    </form>
    <p class="decode-msg" id="decodeMsg" role="status"></p>
    <div class="ph-stats gen-stats reveal">
      <div><b><span data-count="{n_models}">{n_models}</span></b><span>Configurable models</span></div>
      <div><b><span data-count="{n_opts}">{n_opts}</span></b><span>Options</span></div>
      <div><b><span data-count="6">6</span></b><span>Product types</span></div>
    </div>
  </div>
</section>

<section class="gen-app light" id="app">
  <div class="wrap gen-layout">
    <!-- model browser -->
    <aside class="browser" aria-label="Choose a model">
      <div class="br-head">
        <span class="br-step">01</span>
        <div><b>Choose a model</b><span id="brCount">{n_models} models</span></div>
      </div>
      <label class="br-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="brSearch" type="search" placeholder="Search model or name" aria-label="Search models">
      </label>
      <div class="br-types" id="brTypes" role="tablist" aria-label="Product type"></div>
      <div class="br-feats" id="brFeats" aria-label="Features"></div>
      <div class="br-list" id="brList" role="listbox" aria-label="Models"></div>
    </aside>

    <!-- configurator -->
    <div class="config" id="config" aria-live="polite">
      <div class="cfg-empty" id="cfgEmpty">
        <div class="cfg-empty-art" aria-hidden="true"><span>Tx</span><i>-</i><span>?</span><i>-</i><span>?</span><i>-</i><span>?</span></div>
        <b>Select a model to start configuring</b>
        <p>Each option you choose fills in one segment of the ordering code. Every option has its own code, shown on its chip.</p>
      </div>
      <div class="cfg" id="cfg" hidden>
        <header class="cfg-head">
          <div class="cfg-img" id="cfgImg"></div>
          <div class="cfg-meta">
            <span class="br-step">02</span>
            <span class="cfg-type" id="cfgType"></span>
            <h2 id="cfgName"></h2>
            <p id="cfgDesc"></p>
            <div class="cfg-docs" id="cfgDocs"></div>
          </div>
        </header>

        <div class="anatomy" id="anatomy" aria-label="Product code"></div>

        <div class="gspecs-head">
          <b>Configure options</b>
          <span id="specProgress"></span>
          <button class="btn-text" id="resetBtn" type="button">Reset</button>
        </div>
        <div class="g-specs" id="specs"></div>
      </div>
    </div>
  </div>

  <!-- result bar -->
  <div class="result" id="result" hidden>
    <div class="wrap result-inner">
      <div class="res-code">
        <small id="resLabel">Your ordering code</small>
        <code id="resCode"></code>
      </div>
      <div class="res-actions">
        <button class="btn btn-primary" id="copyCode" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg><span>Copy code</span></button>
        <button class="btn btn-ghost" id="copyDesc" type="button">Copy description</button>
        <button class="btn btn-ghost icon-btn" id="shareBtn" type="button" aria-label="Copy share link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg></button>
        <a class="btn btn-ghost" id="quoteBtn" href="contact.html?subject=quote">Request a quote {ARROW}</a>
      </div>
    </div>
  </div>
</section>

<section class="section gen-recent light" id="recentSec" hidden>
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow">On this device</span>
        <h2 class="h2">Recent codes.</h2>
      </div>
      <button class="btn btn-dark" id="clearRecent" type="button">Clear history</button>
    </div>
    <div class="recent-list" id="recentList"></div>
  </div>
</section>

<noscript><div class="wrap" style="padding:60px 0;color:#fff">The code generator needs JavaScript. You can still browse every model and its datasheet on the <a href="products.html" style="color:#4fb2f5">products page</a>.</div></noscript>
'''

build_page('generator.html', main,
           title='Product Code Generator — NeoWave',
           description=f'Configure any of {n_models} NeoWave sensors and controllers and get the exact ordering code. Decode existing codes, share configurations and request a quote.',
           og_title='NeoWave Product Code Generator', og_image='assets/img/catalog-hero.webp', active='generator.html',
           css=['assets/css/generator.css'], js=['assets/js/generator.js'])
print('generator.html written')
