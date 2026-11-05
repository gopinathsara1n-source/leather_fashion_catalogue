import { Link } from 'react-router-dom';
import { ArrowRight, Menu } from 'lucide-react';

export default function App() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark">L</span>
          <span className="brand-name">LEATHER <span>COLLECTION</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#collection">Collection</a>
          <a href="#story">Our Story</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="header-link" href="#collection">Explore catalogue <ArrowRight size={15} /></a>
        <button className="mobile-menu" aria-label="Menu"><Menu size={22} /></button>
      </header>

      <section className="hero" id="home">
        <div className="hero-image" role="img" aria-label="Close-up of richly textured brown leather" />
        <div className="hero-content">
          <p className="eyebrow">MATERIALS WITH CHARACTER</p>
          <h1>Crafted by nature.<br /><em>Chosen by design.</em></h1>
          <p className="hero-copy">Discover a considered collection of fine leathers, selected for their character, texture and timeless appeal.</p>
          <a className="primary-link" href="#collection">Discover the collection <ArrowRight size={17} /></a>
        </div>
        <div className="hero-note"><span>01 / 03</span><span>THE ART OF LEATHER</span></div>
      </section>

      <section className="intro-section" id="collection">
        <p className="eyebrow">A WORLD OF TEXTURE</p>
        <h2>Every hide tells<br />a different story.</h2>
        <p className="intro-copy">Explore our curated leather catalogue. Each article has its own distinctive grain, finish and feel.</p>
        <div className="coming-soon">Your collection will appear here once we connect your Supabase catalogue.</div>
      </section>

      <footer className="site-footer" id="contact">
        <span>LEATHER COLLECTION</span>
        <span>Selected with care. Made to inspire.</span>
      </footer>
    </main>
  );
}