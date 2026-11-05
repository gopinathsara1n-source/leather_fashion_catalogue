import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save, Trash2, AlertTriangle, Check } from 'lucide-react';
import { getLeatherImage, isSupabaseConfigured, supabase } from '../services/supabase.js';

const EMPTY = {
  leather_id: '', article_name: '', collection_name: '', animal: '', color: '', thickness: '',
  tannage: '', origin: '', finish: '', is_active: true,
};
const FIELDS = [
  ['leather_id', 'Leather ID', true],
  ['article_name', 'Article name', true],
  ['collection_name', 'Collection / category'],
  ['animal', 'Animal'],
  ['color', 'Colour', true],
  ['thickness', 'Thickness (mm)'],
  ['tannage', 'Tannage'],
  ['origin', 'Origin'],
  ['finish', 'Finish'],
];

function nextLeatherId(products) {
  const families = new Map();
  products.forEach(({ leather_id }) => {
    const match = String(leather_id || '').trim().match(/^(.*?)(\d+)$/);
    if (!match) return;
    const [, prefix, digits] = match;
    const entry = families.get(prefix) || { count: 0, max: -1, width: digits.length };
    entry.count += 1;
    entry.max = Math.max(entry.max, Number(digits));
    entry.width = Math.max(entry.width, digits.length);
    families.set(prefix, entry);
  });
  const best = [...families.entries()].sort((a, b) =>
    b[1].count - a[1].count || b[1].max - a[1].max
  )[0];
  if (!best) return '';
  const [prefix, data] = best;
  return prefix + String(data.max + 1).padStart(data.width, '0');
}

function isStoragePath(value) {
  return Boolean(value && !/^https?:\/\//i.test(value));
}

export default function AdminPanel({ onProductsChanged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [mainFile, setMainFile] = useState(null);
  const [closeupFile, setCloseupFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const suggestedId = useMemo(() => nextLeatherId(products), [products]);
  const duplicateId = useMemo(() => {
    if (editing || !form.leather_id.trim()) return false;
    return products.some(p => String(p.leather_id).trim().toLowerCase() === form.leather_id.trim().toLowerCase());
  }, [products, form.leather_id, editing]);

  const setNotice = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const verifyAdmin = async currentUser => {
    if (!currentUser || !supabase) {
      setUser(null);
      setAuthorized(false);
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.from('catalogue_admins')
      .select('user_id').eq('user_id', currentUser.id).maybeSingle();
    setUser(currentUser);
    setAuthorized(Boolean(data && !error));
    if (error) setNotice('Admin access is not configured. Run the SQL migration in supabase/migrations first.', 'error');
    else if (!data) setNotice('This account is signed in but is not authorised as a catalogue administrator.', 'error');
    else setNotice('');
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
      .select('*').order('article_name', { ascending: true });
    if (error) setNotice(error.message, 'error');
    else setProducts(data || []);
  };

  useEffect(() => {
    if (authorized) loadAdminProducts();
  }, [authorized]);

  useEffect(() => {
    if (authorized && !editing && !form.leather_id && suggestedId) {
      setForm(current => current.leather_id ? current : { ...current, leather_id: suggestedId });
    }
  }, [authorized, editing, form.leather_id, suggestedId]);

  const login = async e => {
    e.preventDefault();
    setNotice('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setNotice(error.message, 'error');
    else await verifyAdmin(data.user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthorized(false);
    setUser(null);
    setNotice('Signed out.');
  };

  const resetForm = () => {
    setForm({ ...EMPTY, leather_id: suggestedId });
    setEditing(false);
    setMainFile(null);
    setCloseupFile(null);
    setNotice('');
  };

  const editProduct = product => {
    setForm({
      ...EMPTY,
      leather_id: product.leather_id || '',
      article_name: product.article_name || '',
      collection_name: product.collection_name || '',
      animal: product.animal || '',
      color: product.color || '',
      thickness: product.thickness || '',
      tannage: product.tannage || '',
      origin: product.origin || '',
      finish: product.finish || '',
      is_active: product.is_active !== false,
      main_photo: product.main_photo || '',
      closeup_photo: product.closeup_photo || '',
    });
    setEditing(true);
    setMainFile(null);
    setCloseupFile(null);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadImage = async (file, prefix) => {
    if (!file) return null;
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
    const path = `catalogue/${Date.now()}-${prefix}-${safe}`;
    const { error } = await supabase.storage.from('leather-images')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    return path;
  };

  const saveProduct = async e => {
    e.preventDefault();
    if (!editing && duplicateId) {
      setNotice('This Leather ID already exists. Please use the suggested next ID. Your other entered details have been kept.', 'warning');
      return;
    }
    setSaving(true);
    setNotice('');
    const uploadedPaths = [];
    try {
      if (!editing) {
        const { data: existing, error: checkError } = await supabase.from('leather_products')
          .select('leather_id').ilike('leather_id', form.leather_id.trim()).limit(1);
        if (checkError) throw checkError;
        if (existing?.length) {
          setNotice('This Leather ID already exists. Please use the suggested next ID. Your other entered details have been kept.', 'warning');
          setSaving(false);
          return;
        }
      }

      const payload = {
        leather_id: form.leather_id.trim(),
        article_name: form.article_name.trim(),
        collection_name: form.collection_name.trim() || null,
        animal: form.animal || null,
        color: form.color.trim(),
        thickness: form.thickness.trim() || null,
        tannage: form.tannage.trim() || null,
        origin: form.origin.trim() || null,
        finish: form.finish.trim() || null,
        is_active: form.is_active !== false,
      };
      if (mainFile) {
        payload.main_photo = await uploadImage(mainFile, 'main');
        uploadedPaths.push(payload.main_photo);
      }
      if (closeupFile) {
        payload.closeup_photo = await uploadImage(closeupFile, 'closeup');
        uploadedPaths.push(payload.closeup_photo);
      }
      if (!editing && !mainFile) throw new Error('Please upload a main leather photo.');
      if (editing && !payload.main_photo && !form.main_photo) throw new Error('This article has no main photo. Please upload one.');

      const result = editing
        ? await supabase.from('leather_products').update(payload).eq('leather_id', form.leather_id)
        : await supabase.from('leather_products').insert(payload);
      if (result.error) throw result.error;

      setNotice(editing ? 'Article updated successfully.' : 'New article created successfully.', 'success');
      setForm(EMPTY);
      setEditing(false);
      setMainFile(null);
      setCloseupFile(null);
      await loadAdminProducts();
      await onProductsChanged();
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from('leather-images').remove(uploadedPaths);
      setNotice(error.message || 'Unable to save article.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async product => {
    const confirmed = window.confirm(
      `Permanently delete "${product.article_name}" (ID: ${product.leather_id})? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(product.leather_id);
    setNotice('');
    try {
      const { error } = await supabase.from('leather_products')
        .delete().eq('leather_id', product.leather_id);
      if (error) throw error;

      const imagePaths = [product.main_photo, product.closeup_photo].filter(isStoragePath);
      let storageWarning = '';
      if (imagePaths.length) {
        const { error: storageError } = await supabase.storage.from('leather-images').remove(imagePaths);
        if (storageError) storageWarning = ` The article was deleted, but an image could not be removed from storage: ${storageError.message}`;
      }
      if (editing && form.leather_id === product.leather_id) resetForm();
      await loadAdminProducts();
      await onProductsChanged();
      setNotice(`Article "${product.article_name}" deleted.${storageWarning}`, storageWarning ? 'warning' : 'success');
    } catch (error) {
      setNotice(error.message || 'Unable to delete article.', 'error');
    } finally {
      setDeletingId('');
    }
  };

  const toggleActive = async product => {
    const { error } = await supabase.from('leather_products')
      .update({ is_active: !product.is_active }).eq('leather_id', product.leather_id);
    if (error) setNotice(error.message, 'error');
    else {
      await loadAdminProducts();
      await onProductsChanged();
      setNotice(product.is_active ? 'Article hidden from the public catalogue.' : 'Article published to the public catalogue.', 'success');
    }
  };

  if (!isSupabaseConfigured) {
    return <section className="admin-page page-content"><h2>Catalogue administration</h2><p>Configure Supabase before signing in.</p></section>;
  }

  if (!authorized) {
    return <section className="admin-page page-content"><div className="admin-login">
      <LockKeyhole size={28}/><p className="eyebrow">RESTRICTED ACCESS</p><h2>Catalogue admin</h2>
      <p>Sign in with an authorised Supabase account to manage leather articles and photos.</p>
      <form onSubmit={login}>
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label>
        <button className="primary-link" type="submit" disabled={checking}>{checking ? 'Checking…' : 'Sign in'}</button>
      </form>
      {message && <p className="admin-message">{message}</p>}
      <p className="admin-help">Create the user in Supabase Authentication, then add that user's UUID to catalogue_admins using the SQL instructions in the migration file.</p>
    </div></section>;
  }

  return <section className="admin-page page-content">
    <div className="admin-heading">
      <div><p className="eyebrow">AUTHORISED ACCESS</p><h2>Manage the<br/><em>leather catalogue.</em></h2><p>Signed in as {user?.email}</p></div>
      <button className="admin-logout" onClick={logout}><LogOut size={16}/> Sign out</button>
    </div>
    {message && <p className={`admin-message admin-message-${messageType}`}>{message}</p>}
    <form className="admin-form" onSubmit={saveProduct}>
      <div className="admin-form-heading">
        <h3>{editing ? 'Update article' : 'Create new article'}</h3>
        <button type="button" className="admin-secondary" onClick={resetForm}><Plus size={15}/> New entry</button>
      </div>
      <div className="admin-field-grid">
        {FIELDS.map(([key, label, required]) => <label key={key}>
          {label}
          {key === 'animal'
            ? <select value={form[key] || ''} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}>
                <option value="">Select animal</option>
                {['Cow', 'Buffalo', 'Sheep', 'Goat', 'Other'].map(value => <option key={value}>{value}</option>)}
              </select>
            : <input
                required={Boolean(required)}
                readOnly={editing && key === 'leather_id'}
                value={form[key] || ''}
                onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
              />}
          {key === 'leather_id' && !editing && suggestedId && <small className="admin-id-hint">Suggested next ID: <strong>{suggestedId}</strong> <button type="button" onClick={() => setForm(current => ({ ...current, leather_id: suggestedId }))}>Use suggestion</button></small>}
          {key === 'leather_id' && duplicateId && <small className="admin-id-warning"><AlertTriangle size={14}/> This Leather ID already exists. Other entered details are preserved.</small>}
        </label>)}
      </div>
      <div className="admin-upload-grid">
        <label><span>Main leather photo {editing ? '(optional replacement)' : '(required)'}</span><input type="file" accept="image/*" onChange={e => setMainFile(e.target.files?.[0] || null)}/>{mainFile && <small>{mainFile.name}</small>}{editing && form.main_photo && !mainFile && <img src={getLeatherImage(form.main_photo)} alt="Current main leather"/>}</label>
        <label><span>Close-up photo (optional)</span><input type="file" accept="image/*" onChange={e => setCloseupFile(e.target.files?.[0] || null)}/>{closeupFile && <small>{closeupFile.name}</small>}{editing && form.closeup_photo && !closeupFile && <img src={getLeatherImage(form.closeup_photo)} alt="Current close-up leather"/>}</label>
      </div>
      <label className="admin-active"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(current => ({ ...current, is_active: e.target.checked }))}/> Show this article in the public catalogue</label>
      <div className="admin-form-actions">
        <button className="primary-link admin-save" type="submit" disabled={saving || deletingId || (!editing && duplicateId)}>
          <Save size={16}/>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create article'}
        </button>
        {editing && <button type="button" className="admin-cancel" onClick={resetForm}>Cancel update</button>}
      </div>
    </form>

    <div className="admin-list">
      <h3>Existing articles ({products.length})</h3>
      {products.map(product => <div className="admin-row" key={product.leather_id}>
        <div><strong>{product.article_name}</strong><span>{product.leather_id} · {product.color || 'No colour'} · {product.collection_name || product.animal || 'Leather'} · {product.animal || 'Animal not set'} · {product.thickness || 'Thickness not set'} · {product.tannage || 'Tannage not set'} · {product.origin || 'Origin not set'}</span></div>
        <span className={product.is_active ? 'status-active' : 'status-inactive'}>{product.is_active ? 'Active' : 'Hidden'}</span>
        <button type="button" onClick={() => editProduct(product)}>Edit</button>
        <button type="button" onClick={() => toggleActive(product)}>{product.is_active ? 'Hide' : 'Publish'}</button>
        <button type="button" className="admin-delete" disabled={Boolean(deletingId)} onClick={() => deleteProduct(product)}>
          <Trash2 size={14}/>{deletingId === product.leather_id ? 'Deleting…' : 'Delete'}
        </button>
      </div>)}
    </div>
  </section>;
}
