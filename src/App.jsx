import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Menu, Search, X } from 'lucide-react';
import { getLeatherImage, isSupabaseConfigured, supabase } from './services/supabase.js';

function ProductCard({ product }) {
  const image = getLeatherImage(product.main_photo);

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {image ? (
          <img
            className="product-image"
            src={image}
            alt={`${product.article_name} leather in ${product.color || 'natural colour'}`}
            loading="lazy"
          />
        ) : (
          <div className="image-placeholder">LEATHER COLLECTION</div>
        )}
        <span className="product-id">{product.leather_id}</span>
      </div>
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

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
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
      if (queryError) {
        setError(queryError.message || 'We could not load the collection. Please try again later.');
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }

    loadProducts();
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.leather_id, product.article_name, product.color, product.tannage, product.animal, product.origin]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [products, search]);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="#home" onClick={closeMobileNav} aria-label="Leather Collection home">
          <span className="brand-mark">L</span>
          <span className="brand-name">LEATHER <span>COLLECTION</span></span>
        </a>

        <nav className={`desktop-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#home" onClick={closeMobileNav}>Home</a>
          <a href="#collection" onClick={closeMobileNav}>Collection</a>
          <a href="#story" onClick={closeMobileNav}>Our approach</a>
          <a href="#contact" onClick={closeMobileNav}>Contact</a>
        </nav>

        <a className="header-link" href="#collection">Explore catalogue <ArrowRight size={15} /></a>
        <button className="mobile-menu" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <section className="hero" id="home">
        <div className="hero-image" role="img" aria-label="Close-up of richly textured leather" />
        <div className="hero-content">
          <p className="eyebrow">MATERIALS WITH CHARACTER</p>
          <h1>Crafted by nature.<br /><em>Chosen by design.</em></h1>
          <p className="hero-copy">A considered collection of fine leathers, selected for their character, texture and timeless appeal.</p>
          <a className="primary-link" href="#collection">Discover the collection <ArrowRight size={17} /></a>
        </div>
        <div className="hero-note"><span>01 / THE COLLECTION</span><span>SELECTED WITH CARE</span></div>
      </section>

      <section className="collection-section" id="collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A WORLD OF TEXTURE</p>
            <h2>Every hide tells<br />a different story.</h2>
          </div>
          <p className="section-description">Explore our curated leather catalogue. Each article has its own distinctive grain, finish and feel.</p>
        </div>

        <div className="collection-toolbar">
          <p className="collection-count">
            {loading ? 'Loading collection…' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'article' : 'articles'}`}
          </p>
          <label className="search-box">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search article, colour, leather ID…"
              aria-label="Search leather collection"
            />
          </label>
        </div>

        {loading && <div className="collection-message">Preparing the collection…</div>}
        {!loading && error && (
          <div className="collection-message collection-error">
            <strong>Collection not available yet</strong>
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="collection-message">No articles match your search. Try another name, colour or leather ID.</div>
        )}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="product-grid">
            {filteredProducts.map((product) => <ProductCard key={product.leather_id} product={product} />)}
          </div>
        )}
      </section>

      <section className="story-section" id="story">
        <p className="eyebrow">THE DETAILS MATTER</p>
        <h2>Character you can<br /><em>see and feel.</em></h2>
        <p>From natural grain to considered finishes, discover materials chosen for the details that make every article distinct.</p>
      </section>

      <footer className="site-footer" id="contact">
        <a className="footer-brand" href="#home">LEATHER COLLECTION</a>
        <span>Selected with care. Made to inspire.</span>
        <a href="mailto:info@example.com">Contact our team <ArrowUpRight size={14} /></a>
      </footer>
    </main>
  );
}
