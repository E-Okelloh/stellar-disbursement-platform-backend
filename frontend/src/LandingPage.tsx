import { useEffect, useState } from "react";

const styles = `
  .landing-root {
    --green-50: #eaf4ed;
    --green-100: #cae4d3;
    --green-200: #9dd0b0;
    --green-400: #3ea366;
    --green-500: #1b8d4e;
    --green-600: #068241;
    --green-700: #096837;
    --green-800: #0a522e;
    --green-900: #0a4327;

    --rust-100: #f5b2a3;
    --rust-400: #d63d21;
    --rust-500: #c2381f;
    --rust-600: #b23e25;
    --rust-700: #9b2b16;

    --cream-50: #fefcf3;
    --cream-100: #f8efda;
    --cream-200: #f2e1bb;

    --ink: #1c1d1a;
    --ink-soft: #4a4d45;
    --border: #e7ddc4;

    --font: "ABeeZee", system-ui, -apple-system, sans-serif;
    --font-heading: "Barlow Condensed", var(--font);
    color-scheme: light;
  }

  .landing-root * { box-sizing: border-box; }
  .landing-root { scroll-behavior: smooth; }
  .landing-root {
    margin: 0;
    font-family: var(--font);
    color: var(--ink);
    background: var(--cream-50);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .landing-root img { max-width: 100%; display: block; }
  .landing-root a { color: inherit; }
  .landing-root .wrap {
    max-width: 1160px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .landing-root section { padding: 128px 0; }
  @media (max-width: 720px) {
    .landing-root section { padding: 72px 0; }
  }

  .landing-root h1, .landing-root h2, .landing-root h3, .landing-root h4 {
    margin: 0; font-weight: 500; letter-spacing: -0.01em; font-family: var(--font-heading);
  }
  .landing-root .eyebrow {
    display: block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-bottom: 24px;
  }

  .landing-root header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--cream-50);
    border-bottom: 1px solid var(--border);
  }
  .landing-root .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
  }
  .landing-root .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    font-size: 1.15rem;
    color: var(--ink);
    text-decoration: none;
    cursor: pointer;
    background: none;
    border: none;
    font-family: var(--font-heading);
    letter-spacing: 0.01em;
  }
  .landing-root .brand svg { width: 24px; height: 24px; }
  .landing-root .brand small {
    display: block;
    font-size: 0.6rem;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    text-transform: uppercase;
    font-family: var(--font);
  }
  .landing-root nav.links { display: flex; align-items: center; gap: 40px; }
  .landing-root nav.links a {
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 400;
    color: var(--ink-soft);
  }
  .landing-root nav.links a:hover { color: var(--ink); }
  .landing-root .nav-actions { display: flex; align-items: center; gap: 20px; }
  .landing-root .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 22px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.88rem;
    text-decoration: none;
    border: 1px solid transparent;
    cursor: pointer;
    transition: opacity 0.15s ease, background 0.15s ease;
    font-family: var(--font);
  }
  .landing-root .btn-primary { background: var(--ink); color: #fff; }
  .landing-root .btn-primary:hover { background: var(--green-800); }
  .landing-root .btn-ghost { background: transparent; color: var(--ink); border-color: var(--border); }
  .landing-root .btn-ghost:hover { border-color: var(--ink); }
  .landing-root .btn-light { background: #fff; color: var(--ink); }
  .landing-root .btn-light:hover { opacity: 0.85; }

  .landing-root .menu-toggle {
    display: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  @media (max-width: 900px) {
    .landing-root nav.links, .landing-root .nav-actions .btn-ghost { display: none; }
    .landing-root .menu-toggle { display: flex; }
  }
  .landing-root .mobile-panel {
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: 16px 24px 24px;
    border-top: 1px solid var(--border);
  }
  .landing-root .mobile-panel.open { display: flex; }
  .landing-root .mobile-panel a {
    padding: 12px 6px;
    text-decoration: none;
    color: var(--ink);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
  }

  .landing-root .hero {
    padding: 120px 0 100px;
  }
  .landing-root .hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    max-width: 720px;
  }
  .landing-root .hero h1 {
    font-size: clamp(2.4rem, 5vw, 3.6rem);
    line-height: 1.1;
    font-weight: 500;
    color: var(--ink);
  }
  .landing-root .hero h1 span { color: var(--green-700); }
  .landing-root .hero p.lead {
    margin-top: 24px;
    font-size: 1.1rem;
    color: var(--ink-soft);
    max-width: 52ch;
    font-weight: 400;
  }
  .landing-root .hero-ctas { display: flex; gap: 16px; margin-top: 36px; flex-wrap: wrap; }
  .landing-root .hero-stats {
    display: flex;
    gap: 48px;
    margin-top: 64px;
    padding-top: 40px;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 520px) { .landing-root .hero-stats { gap: 28px; flex-wrap: wrap; } }
  .landing-root .stat b { display: block; font-size: 1.6rem; color: var(--ink); font-weight: 500; font-family: var(--font-heading); }
  .landing-root .stat span { font-size: 0.82rem; color: var(--ink-soft); }

  .landing-root .pill {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--ink-soft);
    padding: 0;
    border-radius: 999px;
  }

  .landing-root .section-head { max-width: 640px; margin-bottom: 48px; }
  .landing-root .section-head h2 { font-size: clamp(1.7rem, 3vw, 2.3rem); color: var(--ink); }
  .landing-root .section-head p { margin-top: 14px; color: var(--ink-soft); font-size: 1.02rem; }
  .landing-root .section-alt { background: var(--cream-100); }


  .landing-root .where-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: center;
  }
  @media (max-width: 860px) { .landing-root .where-grid { grid-template-columns: 1fr; } }
  .landing-root .corridor-list { display: flex; flex-direction: column; }
  .landing-root .corridor {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    background: transparent;
    border-top: 1px solid var(--border);
    border-radius: 0;
    padding: 18px 0;
  }
  .landing-root .corridor .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--ink-soft);
    margin-top: 9px;
    flex-shrink: 0;
  }
  .landing-root .corridor h4 { font-size: 0.98rem; color: var(--ink); margin: 0; font-family: var(--font-heading); font-weight: 500; }
  .landing-root .corridor p { margin: 4px 0 0; font-size: 0.88rem; color: var(--ink-soft); }
  .landing-root .map-card {
    background: var(--ink);
    border-radius: 0;
    padding: 40px;
    color: #fff;
    min-height: 320px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
  }
  .landing-root .map-card .pill { color: rgba(255,255,255,0.7); }
  .landing-root .map-card .founded {
    font-size: 0.85rem;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 400;
  }
  .landing-root .map-card .founded b { color: #fff; font-size: 2.4rem; display: block; margin-top: 4px; letter-spacing: 0; font-weight: 500; font-family: var(--font-heading); }

  .landing-root .platform-band {
    border-radius: 0;
    background: var(--ink);
    color: #fff;
    padding: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    flex-wrap: wrap;
  }
  .landing-root .platform-band h2 { font-size: 1.6rem; max-width: 30ch; font-weight: 500; }
  .landing-root .platform-band p { margin-top: 12px; color: rgba(255,255,255,0.7); max-width: 46ch; font-size: 0.98rem; }

  .landing-root .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  @media (max-width: 860px) { .landing-root .contact-grid { grid-template-columns: 1fr; } }
  .landing-root .contact-card {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 32px;
  }
  .landing-root .contact-item { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  .landing-root .contact-item:last-child { border-bottom: none; }
  .landing-root .contact-item .icon {
    width: 24px; height: 24px; border-radius: 0;
    background: none; color: var(--ink-soft);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .landing-root .contact-item h4 { margin: 0; font-size: 0.92rem; color: var(--ink); font-family: var(--font-heading); font-weight: 500; }
  .landing-root .contact-item p { margin: 3px 0 0; font-size: 0.9rem; color: var(--ink-soft); }
  .landing-root .form-row { display: flex; flex-direction: column; gap: 16px; }
  .landing-root .form-row input, .landing-root .form-row textarea, .landing-root .form-row select {
    font-family: inherit;
    font-size: 0.95rem;
    padding: 12px 0;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--ink);
  }
  .landing-root .form-row select { appearance: auto; }
  .landing-root .form-row input:focus, .landing-root .form-row textarea:focus, .landing-root .form-row select:focus {
    outline: none;
    border-color: var(--green-500);
    box-shadow: 0 0 0 3px var(--green-50);
  }
  .landing-root .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 520px) { .landing-root .two-col { grid-template-columns: 1fr; } }

  .landing-root footer { background: var(--ink); color: rgba(255,255,255,0.82); padding: 64px 0 32px; }
  .landing-root .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 32px;
    padding-bottom: 36px;
    border-bottom: 1px solid rgba(255,255,255,0.14);
  }
  @media (max-width: 780px) { .landing-root .footer-grid { grid-template-columns: 1fr 1fr; } }
  .landing-root .footer-grid h4 { color: rgba(255,255,255,0.5); font-size: 0.78rem; font-weight: 400; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 16px; font-family: var(--font); }
  .landing-root .footer-grid a { display: block; text-decoration: none; color: rgba(255,255,255,0.72); font-size: 0.9rem; padding: 6px 0; }
  .landing-root .footer-grid a:hover { color: #fff; }
  .landing-root .footer-brand { display: flex; align-items: center; gap: 10px; font-weight: 500; color: #fff; font-size: 1.1rem; margin-bottom: 14px; font-family: var(--font-heading); }
  .landing-root .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 24px;
    font-size: 0.82rem;
    flex-wrap: wrap;
    gap: 12px;
  }
  .landing-root .socials { display: flex; gap: 10px; }
  .landing-root .socials a {
    width: 28px; height: 28px;
    border-radius: 0;
    background: none;
    color: rgba(255,255,255,0.6);
    display: flex; align-items: center; justify-content: center;
    text-decoration: none;
  }
  .landing-root .socials a:hover { color: #fff; }

  .landing-root ::selection { background: var(--green-200); }
`;

const BrandMark = ({ fill = "#068241" }: { fill?: string }) => (
  <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path
      fill={fill}
      d="M512.111 112.841c54.077 0 106.417 10.454 155.937 30.943 26.279 10.884 51.469 24.755 74.926 40.973l-4.995 2.562-64.289 32.222c-49.080-26.887-104.901-40.973-161.584-40.973h-2.608c-43.653 0.425-86.221 8.961-126.402 25.394-40.179 16.643-76.231 40.333-107.070 70.633-62.984 62.096-97.731 144.471-97.731 231.962 0 14.295 0.87 28.595 2.821 42.891l0.652 4.48 4.125-2.132 799.883-400.973v73.834l-947.781 475.020v-73.833l33.010-16.434c27.582-13.871 44.087-42.465 41.698-72.98-0.652-10.029-1.085-20.058-1.085-30.089 0-53.135 10.644-104.776 31.492-153.431 20.197-46.947 49.082-88.988 85.788-125.262 36.702-36.063 79.489-64.659 127.267-84.504 49.301-19.845 101.861-30.304 155.94-30.304z"
    />
    <path
      fill={fill}
      d="M952.992 413.731l33.008-16.431v-73.834l-947.999 475.022v73.833l804.008-402.251 0.651 4.48c1.954 14.295 2.822 28.811 2.822 43.107 0 87.491-34.751 170.075-97.733 231.961-30.84 30.305-66.89 53.991-107.069 70.635-40.181 16.643-82.75 25.178-126.402 25.394h-2.39c-56.902 0-112.936-14.295-162.017-41.188l-2.608 1.279-66.457 33.291c23.456 16.218 48.648 30.089 75.145 41.188 49.52 20.485 101.86 30.943 155.937 30.943s106.639-10.453 155.94-30.943c47.563-19.845 90.564-48.226 127.268-84.503 36.701-36.279 65.587-78.316 85.788-125.264 20.848-48.652 31.492-100.297 31.492-153.431 0-10.029-0.218-20.273-1.084-30.302-2.39-30.514 14.115-59.112 41.699-72.983z"
    />
  </svg>
);

const NAV_LINKS = [
  { href: "#where-we-work", label: "Where We Work" },
  { href: "#request-access", label: "Platform" },
  { href: "#contact", label: "Contact" },
];

function DemoForm({
  fields,
  submitLabel,
  confirmationText,
}: {
  fields: React.ReactNode;
  submitLabel: string;
  confirmationText: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      className="contact-card form-row"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      {fields}
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
        {submitLabel}
      </button>
      {submitted && (
        <p style={{ color: "var(--green-700)", fontSize: "0.88rem", margin: 0 }}>{confirmationText}</p>
      )}
    </form>
  );
}

export function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    document.title = "SAPCONE — Sustainable Approaches for Community Empowerment";
  }, []);

  return (
    <div className="landing-root">
      <style>{styles}</style>

      <header>
        <div className="wrap nav">
          <a href="#top" className="brand">
            <BrandMark />
            <span>
              SAPCONE
              <small>Community Empowerment</small>
            </span>
          </a>

          <nav className="links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={onLogin}>
              Log In
            </button>
            <a href="#request-access" className="btn btn-primary">
              Request Access
            </a>
            <button
              className="menu-toggle"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
        <div className={`mobile-panel${menuOpen ? " open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <a
            href="#top"
            style={{ color: "var(--green-700)", fontWeight: 700 }}
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              onLogin();
            }}
          >
            Log In →
          </a>
          <a
            href="#request-access"
            style={{ color: "var(--green-700)", fontWeight: 700 }}
            onClick={() => setMenuOpen(false)}
          >
            Request Access →
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Since 2006 · Northern Kenya &amp; Southern Ethiopia</span>
              <h1>
                Building <span>resilient</span> pastoralist communities.
              </h1>
              <p className="lead">
                SAPCONE partners with nomadic pastoralist communities across the Horn of Africa to
                advance self-reliance and sustainable development.
              </p>
              <div className="hero-ctas">
                <a href="#request-access" className="btn btn-primary">
                  Request Platform Access
                </a>
                <a href="#where-we-work" className="btn btn-ghost">
                  Where We Work
                </a>
              </div>
              <div className="hero-stats">
                <div className="stat">
                  <b>19+</b>
                  <span>Years in the field</span>
                </div>
                <div className="stat">
                  <b>4</b>
                  <span>Countries</span>
                </div>
                <div className="stat">
                  <b>6</b>
                  <span>Focus areas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="where-we-work" className="section-alt">
          <div className="wrap where-grid">
            <div>
              <span className="eyebrow">Where We Work</span>
              <h2 style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", color: "var(--ink)", marginBottom: 14 }}>
                Hard-to-reach corridors
              </h2>
              <div className="corridor-list">
                {[
                  ["Turkana County & Kakuma, Kenya", "Our home base."],
                  ["South Sudan Corridor", "Cross-border humanitarian support."],
                  ["Uganda Corridor", "Communities across the Kenya–Uganda border."],
                  ["Southern Ethiopia", "Nomadic communities in the northern frontier."],
                ].map(([title, desc]) => (
                  <div className="corridor" key={title}>
                    <span className="dot" />
                    <div>
                      <h4>{title}</h4>
                      <p>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="map-card">
              <div className="founded">
                Operating since
                <b>2006</b>
              </div>
              <p style={{ opacity: 0.85, fontSize: "0.95rem" }}>
                Continuous partnership with nomadic pastoralist communities.
              </p>
              <div className="map-list">
                <span className="pill">Kenya</span>
                <span className="pill">Uganda</span>
                <span className="pill">South Sudan</span>
                <span className="pill">Ethiopia</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="platform-band">
              <div>
                <h2>Digitizing disbursements for the last mile.</h2>
                <p>DisburseFlow Studio: transparent, auditable bulk payouts.</p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-light" onClick={onLogin}>
                  Log In to Platform
                </button>
                <a href="#request-access" className="btn btn-ghost" style={{ borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}>
                  Request Access
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="request-access" className="section-alt">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">DisburseFlow Studio</span>
              <h2>Request platform access</h2>
              <p>Accounts are provisioned by an existing Owner or Financial Controller — no public signup.</p>
            </div>
            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-item">
                  <div className="icon">1</div>
                  <div>
                    <h4>Tell us about your role</h4>
                  </div>
                </div>
                <div className="contact-item">
                  <div className="icon">2</div>
                  <div>
                    <h4>We verify &amp; provision</h4>
                  </div>
                </div>
                <div className="contact-item">
                  <div className="icon">3</div>
                  <div>
                    <h4>You receive login details</h4>
                  </div>
                </div>
              </div>
              <DemoForm
                submitLabel="Submit Request"
                confirmationText="Thanks — this is a demo form and isn't wired to a backend yet. In production this would notify an Owner to provision your account."
                fields={
                  <>
                    <div className="two-col">
                      <input type="text" placeholder="Full name" required />
                      <input type="email" placeholder="Work email" required />
                    </div>
                    <input type="text" placeholder="Organization" required />
                    <select required defaultValue="">
                      <option value="" disabled>
                        Requested role
                      </option>
                      <option>Owner</option>
                      <option>Financial Controller</option>
                      <option>Approver</option>
                      <option>Uploader / Initiator</option>
                      <option>Finance Officer</option>
                      <option>Developer (read-only / config)</option>
                      <option>Business (read-only)</option>
                    </select>
                    <textarea rows={3} placeholder="Anything else we should know? (optional)" />
                  </>
                }
              />
            </div>
          </div>
        </section>

        <section id="contact">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Get In Touch</span>
              <h2>Partner with us</h2>
              <p>Whether you're a donor, implementing partner, or community stakeholder, we'd love to hear from you.</p>
            </div>
            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-item">
                  <div className="icon">☎</div>
                  <div>
                    <h4>Phone</h4>
                    <p>+254 720 557 266</p>
                  </div>
                </div>
                <div className="contact-item">
                  <div className="icon">✉</div>
                  <div>
                    <h4>Email</h4>
                    <p>info@sapcone.org</p>
                  </div>
                </div>
                <div className="contact-item">
                  <div className="icon">◎</div>
                  <div>
                    <h4>Location</h4>
                    <p>Lodwar, Turkana County, Kenya</p>
                  </div>
                </div>
              </div>
              <DemoForm
                submitLabel="Send Message"
                confirmationText="Thanks — this is a demo form and isn't wired to a backend yet."
                fields={
                  <>
                    <div className="two-col">
                      <input type="text" placeholder="Full name" required />
                      <input type="email" placeholder="Email address" required />
                    </div>
                    <input type="text" placeholder="Organization (optional)" />
                    <textarea rows={4} placeholder="How would you like to partner with SAPCONE?" required />
                  </>
                }
              />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">
                <BrandMark fill="#ffffff" />
                SAPCONE
              </div>
              <p style={{ fontSize: "0.88rem", maxWidth: "32ch", color: "rgba(255,255,255,0.68)" }}>
                Sustainable Approaches for Community Empowerment — building resilient, self-reliant
                pastoralist communities since 2006.
              </p>
            </div>
            <div>
              <h4>Organization</h4>
              <a href="#where-we-work">Where We Work</a>
              <a href="#contact">Contact</a>
            </div>
            <div>
              <h4>Platform</h4>
              <a href="#request-access">Request Access</a>
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  onLogin();
                }}
              >
                Log In
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {year} SAPCONE. All rights reserved.</span>
            <div className="socials">
              <a href="#" aria-label="Facebook">
                f
              </a>
              <a href="#" aria-label="Twitter">
                𝕏
              </a>
              <a href="#" aria-label="YouTube">
                ▶
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
