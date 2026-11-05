import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save, Trash2 } from 'lucide-react';
import { getLeatherImage, isSupabaseConfigured, supabase } from '../services/supabase.js';

const EMPTY = {
  leather_id: '',
  article_name: '',
  animal: '',
  color: '',
  thickness: '',
  tannage: '',
  origin: '',
  main_photo: '',
  closeup_photo: '',
  is_active: true,
};
const FIELDS = [
  ['leather_id', 'Leather ID', true],
  ['article_name', 'Article name', true],
  ['animal', 'Animal', false],
  ['color', 'Colour', true],
  ['thickness', 'Thickness (mm)', false],
  ['tannage', 'Tannage', false],
  ['origin', 'Origin', false],
];

function storagePath(value) {
  return value && !/^https?:\/\//i.test(value) ? value : null;
}

// Uses the existing ID pattern (prefix + trailing number), retaining its zero-padding.
function getNextLeatherId(items) {
  const families = new Map();
  items.forEach(({ leather_id }) => {
    const match = String(leather_id || '').trim().match(/^(.*?)(\d+)$/);
    if (!match) return;
    const prefix = match[1];
    const numberText = match[2];
    const number = Number(numberText);
    const family = families.get(prefix) || { count: 0, max: -1, width: numberText.length };
    family.count += 1;
    if (number > family.max) {
      family.max = number;
      family.width = numberText.length;
    }
    families.set(prefix, family);
  });
  if (!families.size) return '';
  const [prefix, family] = [...families.entries()].sort((a, b) =>
    b[1].count - a[1].count || b[1].max - a[1].max
  )[0];
  return prefix + String(family.max + 1).padStart(family.width, '0');
}

export default function AdminPanel({ onProductsChanged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [mainFile, setMainFile] = useState(null);
  const [closeupFile, setCloseupFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const suggestedLeatherId = getNextLeatherId(products);
  const duplicateProduct = !editing && Boolean(form.leather_id.trim()) &&
    products.some(product => String(product.leather_id).trim().toLowerCase() === form.leather_id.trim().toLowerCase());

  useEffect(() => {
    if (authorized && !editing && !form.leather_id && suggestedLeatherId) {
      setForm(current => current.leather_id ? current : { ...current, leather_id: suggestedLeatherId });
    }
  }, [authorized, editing, form.leather_id, suggestedLeatherId]);

  const verifyAdmin = async (currentUser) => {
    if (!currentUser || !supabase) {
      setUser(null);
      setAuthorized(false);
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.from('catalogue_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle();
    setUser(currentUser);
    setAuthorized(Boolean(data && !error));
    if (error) setMessage('Admin access is not configured. Run the SQL migration in supabase/migrations first.');
    else if (!data) setMessage('This account is signed in but is not authorised as a catalogue administrator.');
    else setMessage('');
    setChecking(false);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) verifyAdmin(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) window.setTimeout(() => verifyAdmin(session.user), 0);
      else {
        setUser(null);
        setAuthorized(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadAdminProducts = async () => {
    const { data, error } = await supabase.from('leather_products')
      .select('leather_id,article_name,animal,color,thickness,tannage,origin,main_photo,closeup_photo,is_active')
      .order('article_name', { ascending: true });
    if (error) setMessage(error.message);
    else setProducts(data || []);
  };

  useEffect(() => {
    if (authorized) loadAdminProducts();
  }, [authorized]);

  const login = async (e) => {
    e.preventDefault();
    setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else await verifyAdmin(data.user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthorized(false);
    setUser(null);
    setMessage('Signed out.');
  };

  const resetForm = () => {
    setForm(EMPTY);
    setEditing(false);
    setMainFile(null);
    setCloseupFile(null);
  };

  const editProduct = (product) => {
    setForm({ ...EMPTY, ...product, is_active: product.is_active !== false });
    setEditing(true);
    setMainFile(null);
    setCloseupFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadImage = async (file, prefix) => {
    if (!file) return null;
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
    const path = `catalogue/${Date.now()}-${prefix}-${safe}`;
    const { error } = await supabase.storage.from('leather-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (duplicateProduct) {
      setMessage(`Leather ID "${form.leather_id.trim()}" already exists. Choose the suggested ID or enter another ID. Your other entries have been kept.`);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        leather_id: form.leather_id.trim(),
        article_name: form.article_name.trim(),
        animal: form.animal,
        color: form.color.trim(),
        thickness: form.thickness.trim(),
        tannage: form.tannage.trim(),
        origin: form.origin.trim(),
        main_photo: form.main_photo || null,
        closeup_photo: form.closeup_photo || null,
        is_active: form.is_active !== false,
      };

      // Check the database too, so a recently-added ID is caught even if this page is stale.
      if (!editing) {
        const { data: existing, error: checkError } = await supabase.from('leather_products')
          .select('leather_id').eq('leather_id', payload.leather_id).maybeSingle();
        if (checkError) throw checkError;
        if (existing) {
          setMessage(`Leather ID "${payload.leather_id}" already exists. Your other entries have been kept; change only the Leather ID to continue.`);
          return;
        }
      }

      const oldMain = form.main_photo;
      const oldCloseup = form.closeup_photo;
      if (mainFile) payload.main_photo = await uploadImage(mainFile, 'main');
      if (closeupFile) payload.closeup_photo = await uploadImage(closeupFile, 'closeup');
      if (!payload.main_photo) throw new Error('Please upload a main leather photo.');

      const result = editing
        ? await supabase.from('leather_products').update(payload).eq('leather_id', form.leather_id)
        : await supabase.from('leather_products').insert(payload);
      if (result.error) throw result.error;

      let notice = editing ? 'Article updated successfully.' : 'New article added successfully.';
      const replacedPaths = [];
      if (mainFile && storagePath(oldMain)) replacedPaths.push(storagePath(oldMain));
      if (closeupFile && storagePath(oldCloseup)) replacedPaths.push(storagePath(oldCloseup));
      if (replacedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('leather-images').remove(replacedPaths);
        if (cleanupError) notice = 'Article saved, but an older replaced image could not be removed: ' + cleanupError.message;
      }
      setMessage(notice);
      resetForm();
      await loadAdminProducts();
      await onProductsChanged();
    } catch (err) {
      setMessage(err.message || 'Unable to save article. Your form entries have been kept.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product) => {
    const { error } = await supabase.from('leather_products')
      .update({ is_active: !product.is_active }).eq('leather_id', product.leather_id);
    if (error) setMessage(error.message);
    else {
      setMessage(product.is_active ? 'Article hidden from the public catalogue.' : 'Article published in the public catalogue.');
      await loadAdminProducts();
      await onProductsChanged();
    }
  };

  const deleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Permanently delete "${product.article_name}" (${product.leather_id})? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(product.leather_id);
    setMessage('');
    try {
      const { error } = await supabase.from('leather_products').delete().eq('leather_id', product.leather_id);
      if (error) throw error;

      const imagePaths = [storagePath(product.main_photo), storagePath(product.closeup_photo)].filter(Boolean);
      if (imagePaths.length) {
        const { error: imageError } = await supabase.storage.from('leather-images').remove(imagePaths);
        if (imageError) setMessage('Article deleted, but its stored photo(s) could not be removed: ' + imageError.message);
        else setMessage('Article and its stored photos deleted successfully.');
      } else {
        setMessage('Article deleted successfully.');
      }
      if (form.leather_id === product.leather_id) resetForm();
      await loadAdminProducts();
      await onProductsChanged();
    } catch (err) {
      setMessage(err.message || 'Unable to delete article.');
    } finally {
      setDeletingId('');
    }
  };

  if (!isSupabaseConfigured) {
    return <section className="admin-page page-content"><h2>Catalogue administration</h2><p>Configure Supabase before signing in.</p></section>;
  }

  if (!authorized) {
    return <section className="admin-page page-content">
      <div className="admin-login">
        <LockKeyhole size={28} />
        <p className="eyebrow">RESTRICTED ACCESS</p>
        <h2>Catalogue admin</h2>
        <p>Sign in with an authorised Supabase account to manage leather articles and photos.</p>
        <form onSubmit={login}>
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          <button className="primary-link" type="submit" disabled={checking}>{checking ? 'Checking…' : 'Sign in'}</button>
        </form>
        {message && <p className="admin-message">{message}</p>}
        <p className="admin-help">Create the user in Supabase Authentication, then add that user's UUID to catalogue_admins using the SQL instructions in the migration file.</p>
      </div>
    </section>;
  }

  return <section className="admin-page page-content">
    <div className="admin-heading">
      <div>
        <p className="eyebrow">AUTHORISED ACCESS</p>
        <h2>Manage the<br /><em>leather catalogue.</em></h2>
        <p>Signed in as {user?.email}</p>
      </div>
      <button className="admin-logout" onClick={logout}><LogOut size={16} /> Sign out</button>
    </div>
    {message && <p className="admin-message">{message}</p>}

    <form className="admin-form" onSubmit={saveProduct}>
      <div className="admin-form-heading">
        <h3>{editing ? 'Update article' : 'Create new article'}</h3>
        <button type="button" className="admin-secondary" onClick={resetForm}><Plus size={15} /> New entry</button>
      </div>
      <p className="admin-form-note">Enter only the details used in the public Leather Collections catalogue.</p>
      <div className="admin-field-grid">
        {FIELDS.map(([key, label, required]) => (
          <label key={key}>{label}
            {key === 'animal'
              ? <select required={required} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}>
                  <option value="">Select animal</option>
                  {['Cow', 'Buffalo', 'Sheep', 'Goat', 'Other'].map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              : <input required={required} readOnly={editing && key === 'leather_id'} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
            {key === 'leather_id' && !editing && suggestedLeatherId && (
              <small className="admin-id-hint">Suggested next ID: <strong>{suggestedLeatherId}</strong></small>
            )}
            {key === 'leather_id' && duplicateProduct && (
              <small className="admin-id-warning" role="alert">This Leather ID already exists. Other details are safe—change only this ID.</small>
            )}
          </label>
        ))}
      </div>
      {!editing && suggestedLeatherId && form.leather_id !== suggestedLeatherId && (
        <button type="button" className="admin-secondary admin-use-suggestion" onClick={() => setForm(current => ({ ...current, leather_id: suggestedLeatherId }))}>
          Use suggested ID: {suggestedLeatherId}
        </button>
      )}
      <div className="admin-upload-grid">
        <label><span>Main leather photo {editing ? '(optional replacement)' : '(required)'}</span>
          <input type="file" accept="image/*" onChange={e => setMainFile(e.target.files?.[0] || null)} />
          {mainFile && <small>{mainFile.name}</small>}
          {editing && form.main_photo && !mainFile && <img src={getLeatherImage(form.main_photo)} alt="Current main leather" />}
        </label>
        <label><span>Close-up photo (optional)</span>
          <input type="file" accept="image/*" onChange={e => setCloseupFile(e.target.files?.[0] || null)} />
          {closeupFile && <small>{closeupFile.name}</small>}
          {editing && form.closeup_photo && !closeupFile && <img src={getLeatherImage(form.closeup_photo)} alt="Current close-up leather" />}
        </label>
      </div>
      <label className="admin-active">
        <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
        Show this article in the public catalogue
      </label>
      <button className="primary-link admin-save" type="submit" disabled={saving || duplicateProduct}>
        <Save size={16} />{saving ? 'Saving…' : editing ? 'Update article' : 'Create article'}
      </button>
    </form>

    <div className="admin-list">
      <h3>Existing articles ({products.length})</h3>
      {products.map(product => (
        <div className="admin-row" key={product.leather_id}>
          <div>
            <strong>{product.article_name}</strong>
            <span>{product.leather_id} · {product.animal || 'Animal not specified'} · {product.color || 'No colour'}</span>
          </div>
          <span className={product.is_active ? 'status-active' : 'status-inactive'}>{product.is_active ? 'Active' : 'Hidden'}</span>
          <button onClick={() => editProduct(product)} disabled={Boolean(deletingId)}>Edit</button>
          <button onClick={() => toggleActive(product)} disabled={Boolean(deletingId)}>{product.is_active ? 'Hide' : 'Publish'}</button>
          <button className="admin-delete" onClick={() => deleteProduct(product)} disabled={deletingId === product.leather_id}>
            <Trash2 size={13} />{deletingId === product.leather_id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ))}
      {!products.length && <p className="admin-empty">No articles found.</p>}
    </div>
  </section>;
}
