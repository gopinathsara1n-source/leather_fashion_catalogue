import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Menu, Search, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getLeatherImage, isSupabaseConfigured, supabase } from './services/supabase.js';
import packageInfo from '../package.json';

const FILTER_FIELDS = [
  { key: 'color', label: 'Colour' },
  { key: 'thickness', label: 'Thickness' },
  { key: 'tannage', label: 'Tannage' },
  { key: 'animal', label: 'Animal' },
  { key: 'origin', label: 'Origin' },
];

function ProductCard({ product, onOpen }) {
  const image = getLeatherImage(product.main_photo);
  return (
    <article className="product-card">
      <button className="product-image-button" type="button" onClick={() => onOpen(product)} aria-label={`View ${product.article_name} images`}>
        <div className="product-image-wrap">
          {image ? <img className="product-image" src={image} alt={`${product.article_name} leather in ${product.color || 'natural colour'}`} loading="lazy" /> : <div className="image-placeholder">LEATHER COLLECTION</div>}
          <span className="product-id">{product.leather_id}</span>
          <span className="image-zoom-hint"><ZoomIn size={14} /> View detail</span>
        </div>
      </button>
      <div className="product-meta">
        <div>
          <p className="product-category">{product.animal || 'Leather'} · {product.tannage || 'Selected finish'}</p>
          <h3>{product.article_name}</h3>
        </div>
        <span className="product-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
      </div>
      <p className="product-colour">{product.color || 'Colour not specified'}</p>
      <div className="product-specs">
        {product.thickness && <span>{product.thickness} mm</span>}
        {product.origin && <span>{product.origin}</span>}
      </div>
    </article>
  );
}

function ImageViewer({ product, onClose }) {
  const [showCloseup, setShowCloseup] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mainImage = getLeatherImage(product.main_photo);
  const closeupImage = getLeatherImage(product.closeup_photo);
  const image = showCloseup && closeupImage ? closeupImage : mainImage;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(4, Number((value + 0.05).toFixed(2))));
      if (event.key === '-') setZoom((value) => Math.max(1, Number((value - 0.05).toFixed(2))));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const resetView = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };
  const changeImage = (closeup) => { setShowCloseup(closeup); resetView(); };

  return (
    <div className="viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="image-viewer" role="dialog" aria-modal="true" aria-label={`${product.article_name} image viewer`}>
        <div className="viewer-header">
          <div><p className="viewer-kicker">{product.leather_id}</p><h3>{product.article_name}</h3><span>{product.color || 'Colour not specified'}</span></div>
          <button className="viewer-close" onClick={onClose} aria-label="Close image viewer"><X size={22} /></button>
        </div>
        <div className="viewer-stage" onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(4, Math.max(1, Number((value + (event.deltaY < 0 ? 0.05 : -0.05)).toFixed(2)))); }} onPointerDown={(event) => { if (zoom > 1) { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y }); } }} onPointerMove={(event) => { if (dragging) setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
          {image ? <img draggable="false" className="viewer-image" src={image} alt={`${product.article_name} leather detail`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} /> : <div className="image-placeholder">IMAGE NOT AVAILABLE</div>}
          <span className="viewer-zoom-level">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="viewer-controls">
          <div className="viewer-image-switch">
            <button className={!showCloseup ? 'active' : ''} onClick={() => changeImage(false)} disabled={!mainImage}>Main image</button>
            <button className={showCloseup ? 'active' : ''} onClick={() => changeImage(true)} disabled={!closeupImage}>Close-up {closeupImage ? '' : '(not available)'}</button>
          </div>
          <div className="viewer-zoom-controls">
            <button onClick={() => setZoom((value) => Math.max(1, Number((value - 0.05).toFixed(2))))} disabled={zoom <= 1} aria-label="Zoom out"><ZoomOut size={17} /></button>
            <button onClick={() => setZoom((value) => Math.min(4, Number((value + 0.05).toFixed(2))))} disabled={zoom >= 4} aria-label="Zoom in"><ZoomIn size={17} /></button>
            <label className="zoom-slider-control"><span>Zoom</span><input type="range" min="1" max="4" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Adjust image zoom" /><span>{Math.round(zoom * 100)}%</span></label>
            <button onClick={resetView} aria-label="Reset zoom and position"><RotateCcw size={16} /> Reset</button>
          </div>
        </div>
        <p className="viewer-tip">Use the slider for fine zoom · Scroll to zoom · Drag to inspect details · Press Esc to close</p>
      </section>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ color: '', thickness: '', tannage: '', animal: '', origin: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!isSupabaseConfigured) {
        setError('Catalogue connection is not configured yet. Add the Supabase environment variables to continue.');
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('leather_products')
        .select('leather_id, article_name, color, thickness, tannage, animal, origin, main_photo, closeup_photo')
        .eq('is_active', true)
        .order('article_name', { ascending: true });
      if (!active) return;
      if (queryError) setError(queryError.message || 'We could not load the collection. Please try again later.');
      else setProducts(data || []);
      setLoading(false);
    }
    loadProducts();
    return () => { active = false; };
  }, []);

  const filterOptions = useMemo(() => Object.fromEntries(FILTER_FIELDS.map(({ key }) => [
    key, [...new Set(products.map((product) => product[key]).filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map(String))].sort((a, b) => a.localeCompare(b))
  ])), [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !term || [product.leather_id, product.article_name, product.color, product.thickness, product.tannage, product.animal, product.origin].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      const matchesFilters = FILTER_FIELDS.every(({ key }) => !filters[key] || String(product[key] ?? '') === filters[key]);
      return matchesSearch && matchesFilters;
    });
  }, [products, search, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setFilters({ color: '', thickness: '', tannage: '', animal: '', origin: '' }); };
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="#home" onClick={closeMobileNav} aria-label="Leather Collection home"><span className="brand-mark">L</span><span className="brand-name">LEATHER <span>COLLECTION</span></span></a>
        <nav className={`desktop-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#home" onClick={closeMobileNav}>Home</a><a href="#collection" onClick={closeMobileNav}>Collection</a><a href="#story" onClick={closeMobileNav}>Our approach</a><a href="#contact" onClick={closeMobileNav}>Contact</a>
        </nav>
        <a className="header-link" href="#collection">Explore catalogue <ArrowRight size={15} /></a>
        <button className="mobile-menu" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </header>

      <section className="hero" id="home">
        <div className="hero-image" role="img" aria-label="Close-up of richly textured leather" />
        <div className="hero-content"><p className="eyebrow">MATERIALS WITH CHARACTER</p><h1>Crafted by nature.<br /><em>Chosen by design.</em></h1><p className="hero-copy">A considered collection of fine leathers, selected for their character, texture and timeless appeal.</p><a className="primary-link" href="#collection">Discover the collection <ArrowRight size={17} /></a></div>
        <div className="hero-note"><span>01 / THE COLLECTION</span><span>SELECTED WITH CARE</span></div>
      </section>

      <section className="collection-section" id="collection">
        <div className="section-heading"><div><p className="eyebrow">A WORLD OF TEXTURE</p><h2>Every hide tells<br />a different story.</h2></div><p className="section-description">Explore our curated leather catalogue. Each article has its own distinctive grain, finish and feel.</p></div>
        <div className="collection-toolbar">
          <p className="collection-count">{loading ? 'Loading collection…' : `${filteredProducts.length} of ${products.length} articles`}</p>
          <label className="search-box"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search article, colour, leather ID…" aria-label="Search leather collection" /></label>
        </div>
        <div className="filter-panel">
          <div className="filter-panel-heading"><span>Filter collection</span><button onClick={clearFilters} disabled={!search && !activeFilterCount}>Clear all{activeFilterCount ? ` (${activeFilterCount})` : ''}</button></div>
          <div className="filter-grid">
            {FILTER_FIELDS.map(({ key, label }) => <label className="filter-field" key={key}><span>{label}</span><select value={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}><option value="">All {label.toLowerCase()}s</option>{filterOptions[key].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
          </div>
        </div>
        {loading && <div className="collection-message">Preparing the collection…</div>}
        {!loading && error && <div className="collection-message collection-error"><strong>Collection not available yet</strong><span>{error}</span></div>}
        {!loading && !error && filteredProducts.length === 0 && <div className="collection-message">No articles match your search or filters. Try changing or clearing them.</div>}
        {!loading && !error && filteredProducts.length > 0 && <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.leather_id} product={product} onOpen={setSelectedProduct} />)}</div>}
      </section>

      <section className="story-section" id="story"><p className="eyebrow">THE DETAILS MATTER</p><h2>Character you can<br /><em>see and feel.</em></h2><p>From natural grain to considered finishes, discover materials chosen for the details that make every article distinct.</p></section>
      <footer className="site-footer" id="contact"><a className="footer-brand" href="#home">LEATHER COLLECTION</a><span>Selected with care. Made to inspire.</span><span className="footer-contact">CONTACT &amp; SUPPORT</span><span className="footer-version">Version v{packageInfo.version} <span aria-hidden="true">·</span> Updated 05 Nov 2026</span></footer>
      {selectedProduct && <ImageViewer product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </main>
  );
}
