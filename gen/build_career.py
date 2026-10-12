"""Build site/career.html.  Run:  python -I gen/build_career.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import build_page  # noqa: E402

ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg>'

WORK = [
    ('io', 'I/O &amp; Data Transmission', 'Managed industrial switches and I/O modules', 'assets/img/industrial-cabinet.webp'),
    ('sensors', 'Sensors &amp; Switches', 'Temperature, humidity, air quality, pressure, level &amp; flow', 'assets/img/banner-sensors.webp'),
    ('hvac', 'HVAC Control', 'Smart thermostats and damper actuators', 'assets/img/smart-living.webp'),
    ('power', 'Power &amp; Energy', 'Ultrasonic BTU and water metering', 'assets/img/banner-power.webp'),
    ('safety', 'Life Safety', 'Fire alarm systems and gas detection', 'assets/img/banner-safety.webp'),
]

work_rows = '\n'.join(f'''      <a class="work-row reveal" href="products.html#fam-{fid}" data-img="{img}">
        <span class="wr-num">{i:02d}</span>
        <span class="wr-name">{name}</span>
        <span class="wr-desc">{desc}</span>
        <span class="tile-arrow">{ARROW}</span>
      </a>''' for i, (fid, name, desc, img) in enumerate(WORK, 1))

main = f'''<main>
<!-- ============ HERO ============ -->
<section class="page-hero page-hero--cover">
  <div class="page-hero-media">
    <video autoplay muted loop playsinline preload="auto" poster="assets/img/career-hero.webp"><source src="assets/video/career-hero.mp4" type="video/mp4"></video>
  </div>
  <div class="wrap page-hero-content">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><b>Career</b></nav>
    <span class="eyebrow reveal">Careers at NeoWave</span>
    <h1 data-split>Join our <em>global</em> team.<br>Shape smarter spaces.</h1>
    <p class="lede reveal">We're a technology company specializing in smart home solutions, Building Management Systems and cutting-edge electronics, and we're looking for talented people from around the world.</p>
    <div class="hero-actions reveal">
      <a class="btn btn-primary" href="#apply">Send an open application {ARROW}</a>
      <a class="btn btn-ghost" href="#build">What we build</a>
    </div>
  </div>
</section>

<!-- ============ MISSION ============ -->
<section class="mission">
  <div class="wrap">
    <span class="eyebrow reveal">Our mission</span>
    <p class="mission-text" data-split="scrub">At NeoWave, we are passionate about <strong>revolutionizing the way people interact with their homes and buildings</strong> through <strong>advanced technology and intelligent systems.</strong> We're pushing the boundaries of what's possible, and we'd love you to <strong>push them with us.</strong></p>
  </div>
</section>

<!-- ============ WHY ============ -->
<section class="section light">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow reveal">Why work at NeoWave</span>
        <h2 class="h2" data-split>Build the future of<br>smart living.</h2>
      </div>
      <p class="lede reveal">Joining NeoWave means becoming part of a dynamic team that is shaping the future of smart living and building automation.</p>
    </div>
    <div class="why-grid perks">
      <div class="why reveal"><span class="why-n">01</span>
        <div class="why-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/></svg></div>
        <h3>Shape smart living</h3><p>Work on the devices and systems that change how people live in, and interact with, their homes and buildings.</p></div>
      <div class="why reveal"><span class="why-n">02</span>
        <div class="why-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg></div>
        <h3>Push the boundaries</h3><p>We're committed to pushing the boundaries of what's possible in building automation and intelligent electronics.</p></div>
      <div class="why reveal"><span class="why-n">03</span>
        <div class="why-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></div>
        <h3>A global team</h3><p>We're looking for talented individuals from around the world to help us reach our goals, wherever they're based.</p></div>
      <div class="why reveal"><span class="why-n">04</span>
        <div class="why-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg></div>
        <h3>Real-world impact</h3><p>60 devices across five product families, with 100K+ products sold to 200+ customers. Your work ships.</p></div>
    </div>
  </div>
</section>

<!-- ============ WHAT WE BUILD ============ -->
<section class="build" id="build">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow reveal">What you'll work on</span>
        <h2 class="h2" data-split>Five product families.<br>One ecosystem.</h2>
      </div>
      <p class="lede reveal">From a single room sensor to plant-wide networks. Hover a family to take a look, or click through to the full catalog.</p>
    </div>
    <div class="work-list">
{work_rows}
    </div>
  </div>
  <div class="work-preview" aria-hidden="true"><img alt=""></div>
</section>

<!-- ============ LAB ============ -->
<section class="lab">
  <div class="wrap lab-grid">
    <div class="lab-visual reveal"><img src="assets/img/career-lab.webp" alt="Electronics R&amp;D workbench with NeoWave thermostat, sensor and I/O module prototypes" loading="lazy"></div>
    <div>
      <span class="eyebrow reveal">From idea to installed device</span>
      <h2 class="h2" data-split>Engineered with<br>care, end to end.</h2>
      <p class="lede reveal">Every NeoWave device, from a room sensor to a 28-port industrial switch, ships with full documentation and BMS-ready connectivity like Modbus and BACnet. Join the people behind them.</p>
      <div class="lab-stats reveal">
        <div><b><span data-count="60">60</span></b><span>Devices in the catalog</span></div>
        <div><b><span data-count="82">82</span></b><span>Datasheets &amp; manuals</span></div>
        <div><b><span data-count="200">200</span><sup>+</sup></b><span>Customers</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ============ APPLY ============ -->
<section class="cta apply" id="apply">
  <div class="wrap">
    <div class="cta-card apply-card">
      <svg class="waves" id="waves" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="apply-grid">
        <div class="apply-intro">
          <span class="eyebrow">Open application</span>
          <h2 data-split>Ready to ride<br>the wave?</h2>
          <p class="lede">Tell us a little about yourself and where you'd like to make an impact. We read every application.</p>
          <ol class="apply-steps">
            <li><b>01</b><span>Fill in the form</span></li>
            <li><b>02</b><span>Your email app opens with everything filled in</span></li>
            <li><b>03</b><span>Attach your CV and hit send</span></li>
          </ol>
        </div>
        <form class="apply-form" id="applyForm" novalidate>
          <div class="field"><input id="f-name" name="name" required autocomplete="name" placeholder=" "><label for="f-name">Full name</label></div>
          <div class="field"><input id="f-email" name="email" type="email" required autocomplete="email" placeholder=" "><label for="f-email">Email</label></div>
          <div class="field-row">
            <div class="field"><input id="f-loc" name="location" autocomplete="country-name" placeholder=" "><label for="f-loc">Country / city</label></div>
            <div class="field"><input id="f-link" name="link" type="url" placeholder=" "><label for="f-link">LinkedIn or portfolio</label></div>
          </div>
          <fieldset class="areas">
            <legend>Area of interest</legend>
            <label><input type="radio" name="area" value="Engineering &amp; R&amp;D" checked><span>Engineering &amp; R&amp;D</span></label>
            <label><input type="radio" name="area" value="Sales &amp; business development"><span>Sales &amp; business</span></label>
            <label><input type="radio" name="area" value="Technical support &amp; field service"><span>Support &amp; field service</span></label>
            <label><input type="radio" name="area" value="Operations"><span>Operations</span></label>
            <label><input type="radio" name="area" value="Other"><span>Other</span></label>
          </fieldset>
          <div class="field"><textarea id="f-msg" name="message" rows="4" placeholder=" "></textarea><label for="f-msg">Tell us about yourself</label></div>
          <button class="btn btn-primary btn-submit" type="submit">Prepare my application {ARROW}</button>
          <p class="form-note" id="formNote">Opens your email app addressed to info@neowave.tech. Nothing is sent until you hit send.</p>
        </form>
      </div>
    </div>
  </div>
</section>
'''

build_page(
    'career.html', main,
    title='Careers — Join the NeoWave Team',
    description='Join NeoWave and help shape the future of smart living and building automation. Send an open application to our global team.',
    og_title='Careers at NeoWave',
    og_image='assets/img/career-hero.webp',
    active='career.html',
    css=['assets/css/career.css'],
    js=['assets/js/career.js'],
    cta=False,
)
print('career.html written')
