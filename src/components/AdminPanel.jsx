import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save, Trash2, AlertTriangle, Search, Pencil, CheckCircle2 } from 'lucide-react';
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
  const usedNumbers = products
    .map(({ leather_id }) => {
      const match = String(leather_id || '').trim().match(/^BIL(\d{5})$/i);
      return match ? Number(match[1]) : null;
    })
    .filter(number => number !== null);

  let nextNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  const used = new Set(usedNumbers);
  while (used.has(nextNumber)) nextNumber += 1;

  return `BIL${String(nextNumber).padStart(5, '0')}`;
}

function isStoragePath(value) {
  const url = String(value || '').toLowerCase();
  return Boolean(value && !url.startsWith('http://') && !url.startsWith('https://'));
}

function matchesSearch(product, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [product.leather_id, product.article_name, product.color, product.collection_name]
    .filter(Boolean).some(value => String(value).toLowerCase().includes(term));
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
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [mainFile, setMainFile] = useState(null);
  const [closeupFile, setCloseupFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [activeTab, setActiveTab] = useState('add');
  const [updateSearch, setUpdateSearch] = useState('');
  const [deleteSearch, setDeleteSearch] = useState('');
  const [selectedUpdateId, setSelectedUpdateId] = useState('');
  const [selectedDeleteId, setSelectedDeleteId] = useState('');

  const suggestedId = useMemo(() => nextLeatherId(products), [products]);
  const duplicateId = useMemo(() => {
    if (editing || !form.leather_id.trim()) return false;
    return products.some(p => String(p.leather_id).trim().toLowerCase() === form.leather_id.trim().toLowerCase());
  }, [products, form.leather_id, editing]);
  const updateMatches = useMemo(() => products.filter(p => matchesSearch(p, updateSearch)), [products, updateSearch]);
  const deleteMatches = useMemo(() => products.filter(p => matchesSearch(p, deleteSearch)), [products, deleteSearch]);
  const selectedForDelete = products.find(p => p.leather_id === selectedDeleteId);

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
    if (error) {
      setProductsLoaded(false);
      setNotice(error.message, 'error');
    } else {
      setProducts(data || []);
      setProductsLoaded(true);
    }
  };

  useEffect(() => {
    if (authorized) loadAdminProducts();
  }, [authorized]);

  useEffect(() => {
    if (authorized && productsLoaded && activeTab === 'add' && !editing && !form.leather_id && suggestedId) {
      setForm(current => current.leather_id ? current : { ...current, leather_id: suggestedId });
    }
  }, [authorized, productsLoaded, activeTab, editing, form.leather_id, suggestedId]);

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
    setForm({ ...EMPTY, leather_id: productsLoaded ? suggestedId : '' });
    setEditing(false);
    setMainFile(null);
    setCloseupFile(null);
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

      const wasEditing = editing;
      setNotice(wasEditing ? `Article "${form.article_name}" updated successfully.` : 'New article created successfully.', 'success');
      setForm(EMPTY);
      setEditing(false);
      setMainFile(null);
      setCloseupFile(null);
      setSelectedUpdateId('');
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
      `CAUTION: You are about to permanently delete this catalogue article.\n\nArticle: ${product.article_name}\nLeather ID: ${product.leather_id}\n\nIts catalogue record and stored leather images will be removed. This action cannot be undone.\n\nDo you want to permanently delete this article?`
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
      setSelectedDeleteId('');
      setDeleteSearch('');
      await loadAdminProducts();
      await onProductsChanged();
      setNotice(`Article "${product.article_name}" permanently deleted.${storageWarning}`, storageWarning ? 'warning' : 'success');
    } catch (error) {
      setNotice(error.message || 'Unable to delete article.', 'error');
    } finally {
      setDeletingId('');
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
    <div className="admin-tabs" role="tablist" aria-label="Article management">
      <button type="button" role="tab" aria-selected={activeTab === 'add'} className={activeTab === 'add' ? 'active' : ''} onClick={() => { setActiveTab('add'); setNotice(''); if (!editing) resetForm(); }}>Add New Article</button>
      <button type="button" role="tab" aria-selected={activeTab === 'update'} className={activeTab === 'update' ? 'active' : ''} onClick={() => { setActiveTab('update'); setEditing(false); setForm(EMPTY); setMainFile(null); setCloseupFile(null); setNotice(''); }}>Update Article</button>
      <button type="button" role="tab" aria-selected={activeTab === 'delete'} className={activeTab === 'delete' ? 'active' : ''} onClick={() => { setActiveTab('delete'); setEditing(false); setForm(EMPTY); setMainFile(null); setCloseupFile(null); setNotice(''); }}>Delete Article</button>
    </div>
    {message && <p className={`admin-message admin-message-${messageType}`} role="status">{message}</p>}

    {activeTab === 'add' && <form className="admin-form" onSubmit={saveProduct}>
      <div className="admin-form-heading">
        <h3>Create new article</h3>
        <button type="button" className="admin-secondary" onClick={resetForm}><Plus size={15}/> Clear form</button>
      </div>
      <div className="admin-field-grid">
        {FIELDS.map(([key, label, required]) => <label key={key}>
          {label}
          {key === 'animal'
            ? <select value={form[key] || ''} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}>
                <option value="">Select animal</option>
                {['Cow', 'Buffalo', 'Sheep', 'Goat', 'Other'].map(value => <option key={value}>{value}</option>)}
              </select>
            : <input required={Boolean(required)} value={form[key] || ''} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}/>}
          {key === 'leather_id' && suggestedId && <small className="admin-id-hint">Suggested next ID: <strong>{suggestedId}</strong> <button type="button" onClick={() => setForm(current => ({ ...current, leather_id: suggestedId }))}>Use suggestion</button></small>}
          {key === 'leather_id' && duplicateId && <small className="admin-id-warning"><AlertTriangle size={14}/> This Leather ID already exists. Other entered details are preserved.</small>}
        </label>)}
      </div>
      <div className="admin-upload-grid">
        <label><span>Main leather photo (required)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setMainFile(e.target.files?.[0] || null)}/>{mainFile && <small>{mainFile.name}</small>}</label>
        <label><span>Close-up photo (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setCloseupFile(e.target.files?.[0] || null)}/>{closeupFile && <small>{closeupFile.name}</small>}</label>
      </div>
      <label className="admin-active"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(current => ({ ...current, is_active: e.target.checked }))}/> Show this article in the public catalogue</label>
      <div className="admin-form-actions"><button className="primary-link admin-save" type="submit" disabled={saving || Boolean(deletingId) || duplicateId}><Plus size={16}/>{saving ? 'Creating…' : 'Create article'}</button></div>
    </form>}

    {activeTab === 'update' && <div className="admin-workspace">
      <div className="admin-form-heading"><div><h3>Find an article to update</h3><p>Search by article name, colour or Leather ID, then select the exact Leather ID.</p></div></div>
      <label className="admin-search"><Search size={17}/><input type="search" value={updateSearch} onChange={e => { setUpdateSearch(e.target.value); setSelectedUpdateId(''); setEditing(false); }} placeholder="Search article name, colour or Leather ID…"/></label>
      <label className="admin-select-label">Select Leather ID
        <select value={selectedUpdateId} onChange={e => { setSelectedUpdateId(e.target.value); setEditing(false); }}>
          <option value="">Choose an article…</option>
          {updateMatches.map(p => <option key={p.leather_id} value={p.leather_id}>{p.leather_id} — {p.article_name}</option>)}
        </select>
      </label>
      {updateMatches.length === 0 && <p className="admin-empty">No articles match your search.</p>}
      {selectedUpdateId && !editing && <div className="admin-selected-card"><div><strong>{products.find(p => p.leather_id === selectedUpdateId)?.article_name}</strong><span>Leather ID: {selectedUpdateId}</span></div><button className="primary-link admin-action-button" type="button" onClick={() => { const product = products.find(p => p.leather_id === selectedUpdateId); if (product) editProduct(product); }}> <Pencil size={15}/> Load article for update</button></div>}
      {editing && <form className="admin-form admin-edit-form" onSubmit={saveProduct}>
        <div className="admin-form-heading"><h3>Update selected article</h3><span className="admin-current-id">ID: {form.leather_id}</span></div>
        <div className="admin-field-grid">
          {FIELDS.map(([key, label, required]) => <label key={key}>
            {label}
            {key === 'animal'
              ? <select value={form[key] || ''} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}><option value="">Select animal</option>{['Cow', 'Buffalo', 'Sheep', 'Goat', 'Other'].map(value => <option key={value}>{value}</option>)}</select>
              : <input required={Boolean(required)} readOnly={key === 'leather_id'} value={form[key] || ''} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}/>}
          </label>)}
        </div>
        <div className="admin-upload-grid">
          <label>
            <span>Replace main leather photo (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={e => setMainFile(e.target.files?.[0] || null)}
            />
            {mainFile && <small>{mainFile.name}</small>}
            {form.main_photo && !mainFile && (
              <img
                src={getLeatherImage(form.main_photo)}
                alt="Current main leather"
              />
            )}
          </label>
          <label>
            <span>Replace close-up photo (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={e => setCloseupFile(e.target.files?.[0] || null)}
            />
            {closeupFile && <small>{closeupFile.name}</small>}
            {form.closeup_photo && !closeupFile && (
              <img
                src={getLeatherImage(form.closeup_photo)}
                alt="Current close-up leather"
              />
            )}
          </label>
        </div>
        <label className="admin-active"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(current => ({ ...current, is_active: e.target.checked }))}/> Show this article in the public catalogue</label>
        <div className="admin-form-actions"><button className="primary-link admin-save" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Updating…' : 'Update article'}</button><button type="button" className="admin-cancel" onClick={() => { setEditing(false); setForm(EMPTY); setMainFile(null); setCloseupFile(null); }}>Cancel</button></div>
      </form>}
    </div>}

    {activeTab === 'delete' && <div className="admin-workspace admin-delete-workspace">
      <div className="admin-form-heading"><div><h3>Find an article to delete</h3><p>Search the catalogue, then choose the Leather ID you want to remove.</p></div></div>
      <label className="admin-search"><Search size={17}/><input type="search" value={deleteSearch} onChange={e => { setDeleteSearch(e.target.value); setSelectedDeleteId(''); }} placeholder="Search article name, colour or Leather ID…"/></label>
      <label className="admin-select-label">Select Leather ID
        <select value={selectedDeleteId} onChange={e => setSelectedDeleteId(e.target.value)}>
          <option value="">Choose an article…</option>
          {deleteMatches.map(p => <option key={p.leather_id} value={p.leather_id}>{p.leather_id} — {p.article_name}</option>)}
        </select>
      </label>
      {deleteMatches.length === 0 && <p className="admin-empty">No articles match your search.</p>}
      {selectedForDelete && <div className="admin-delete-preview">
        {selectedForDelete.main_photo && <img src={getLeatherImage(selectedForDelete.main_photo)} alt={selectedForDelete.article_name}/>}
        <div className="admin-delete-details"><p className="admin-caution"><AlertTriangle size={16}/> Permanent deletion</p><h4>{selectedForDelete.article_name}</h4><strong>{selectedForDelete.leather_id}</strong><span>{selectedForDelete.color || 'Colour not specified'} · {selectedForDelete.animal || 'Animal not specified'} · {selectedForDelete.thickness || 'Thickness not specified'}</span><p>This removes the article record and its stored catalogue photos. This action cannot be undone.</p><button type="button" className="admin-delete-confirm" disabled={Boolean(deletingId)} onClick={() => deleteProduct(selectedForDelete)}><Trash2 size={16}/>{deletingId === selectedForDelete.leather_id ? 'Deleting…' : 'Permanently delete article'}</button></div>
      </div>}
    </div>}
    <div className="admin-record-count"><CheckCircle2 size={15}/> {products.length} articles currently in the catalogue</div>
  </section>;
}
