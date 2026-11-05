import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save } from 'lucide-react';
import { getLeatherImage, isSupabaseConfigured, supabase } from '../services/supabase.js';

const EMPTY = { leather_id: '', article_name: '', collection_name: '', color: '', thickness: '', tannage: '', animal: '', origin: '', finish: '', grain: '', application: '', description: '', remarks: '', is_active: true };
const FIELDS = [['leather_id','Leather ID',true],['article_name','Article name',true],['collection_name','Collection / range'],['animal','Animal'],['color','Colour'],['thickness','Thickness (mm)'],['tannage','Tannage'],['origin','Origin'],['finish','Finish'],['grain','Grain / texture'],['application','Application']];

export default function AdminPanel({ onProductsChanged }) {
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [user,setUser]=useState(null), [authorized,setAuthorized]=useState(false), [checking,setChecking]=useState(false), [message,setMessage]=useState('');
  const [products,setProducts]=useState([]), [form,setForm]=useState(EMPTY), [editing,setEditing]=useState(false), [mainFile,setMainFile]=useState(null), [closeupFile,setCloseupFile]=useState(null), [saving,setSaving]=useState(false);
  const verifyAdmin = async (currentUser) => {
    if (!currentUser || !supabase) { setUser(null); setAuthorized(false); return; }
    setChecking(true);
    const {data,error}=await supabase.from('catalogue_admins').select('user_id').eq('user_id',currentUser.id).maybeSingle();
    setUser(currentUser); setAuthorized(Boolean(data && !error));
    if(error) setMessage('Admin access is not configured. Run the SQL migration in supabase/migrations first.');
    else if(!data) setMessage('This account is signed in but is not authorised as a catalogue administrator.');
    else setMessage('');
    setChecking(false);
  };
  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>{if(data.session?.user) verifyAdmin(data.session.user);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(session?.user) verifyAdmin(session.user); else {setUser(null);setAuthorized(false);}
    });
    return ()=>listener.subscription.unsubscribe();
  },[]);
  const loadAdminProducts=async()=>{
    const {data,error}=await supabase.from('leather_products').select('*').order('article_name',{ascending:true});
    if(error) setMessage(error.message); else setProducts(data||[]);
  };
  useEffect(()=>{if(authorized) loadAdminProducts();},[authorized]);
  const login=async(e)=>{
    e.preventDefault();setMessage('');
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) setMessage(error.message); else await verifyAdmin(data.user);
  };
  const logout=async()=>{await supabase.auth.signOut();setAuthorized(false);setUser(null);setMessage('Signed out.');};
  const resetForm=()=>{setForm(EMPTY);setEditing(false);setMainFile(null);setCloseupFile(null);};
  const editProduct=(p)=>{setForm({...EMPTY,...p,is_active:p.is_active!==false});setEditing(true);setMainFile(null);setCloseupFile(null);window.scrollTo({top:0,behavior:'smooth'});};
  const uploadImage=async(file,prefix)=>{
    if(!file) return null;
    const safe=file.name.toLowerCase().replace(/[^a-z0-9.-]+/g,'-');
    const path=`catalogue/${Date.now()}-${prefix}-${safe}`;
    const {error}=await supabase.storage.from('leather-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
    if(error) throw error; return path;
  };
  const saveProduct=async(e)=>{
    e.preventDefault();setSaving(true);setMessage('');
    try{
      const payload={...form};
      if(mainFile) payload.main_photo=await uploadImage(mainFile,'main');
      if(closeupFile) payload.closeup_photo=await uploadImage(closeupFile,'closeup');
      if(!payload.main_photo&&!editing) throw new Error('Please upload a main leather photo.');
      const result=editing
        ? await supabase.from('leather_products').update(payload).eq('leather_id',form.leather_id)
        : await supabase.from('leather_products').insert(payload);
      if(result.error) throw result.error;
      setMessage(editing?'Article updated successfully.':'New article added successfully.');
      resetForm();await loadAdminProducts();await onProductsChanged();
    }catch(err){setMessage(err.message||'Unable to save article.');}
    finally{setSaving(false);}
  };
  const toggleActive=async(p)=>{
    const {error}=await supabase.from('leather_products').update({is_active:!p.is_active}).eq('leather_id',p.leather_id);
    if(error) setMessage(error.message); else {await loadAdminProducts();await onProductsChanged();}
  };
  if(!isSupabaseConfigured) return <section className="admin-page page-content"><h2>Catalogue administration</h2><p>Configure Supabase before signing in.</p></section>;
  if(!authorized) return <section className="admin-page page-content"><div className="admin-login"><LockKeyhole size={28}/><p className="eyebrow">RESTRICTED ACCESS</p><h2>Catalogue admin</h2><p>Sign in with an authorised Supabase account to manage leather articles and photos.</p><form onSubmit={login}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="primary-link" type="submit" disabled={checking}>{checking?'Checking…':'Sign in'}</button></form>{message&&<p className="admin-message">{message}</p>}<p className="admin-help">Create the user in Supabase Authentication, then add that user's UUID to catalogue_admins using the SQL instructions in the migration file.</p></div></section>;
  return <section className="admin-page page-content">
    <div className="admin-heading"><div><p className="eyebrow">AUTHORISED ACCESS</p><h2>Manage the<br/><em>leather catalogue.</em></h2><p>Signed in as {user?.email}</p></div><button className="admin-logout" onClick={logout}><LogOut size={16}/> Sign out</button></div>
    {message&&<p className="admin-message">{message}</p>}
    <form className="admin-form" onSubmit={saveProduct}><div className="admin-form-heading"><h3>{editing?'Edit article':'Add a new article'}</h3><button type="button" className="admin-secondary" onClick={resetForm}><Plus size={15}/> New entry</button></div>
      <div className="admin-field-grid">{FIELDS.map(([key,label,required])=><label key={key}>{label}{key==='animal'?<select value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Select animal</option>{['Cow','Buffalo','Sheep','Goat','Other'].map(v=><option key={v}>{v}</option>)}</select>:<input required={Boolean(required)} readOnly={editing&&key==='leather_id'} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}</div>
      <label className="admin-wide">Description<textarea rows="3" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="admin-wide">Remarks<textarea rows="2" value={form.remarks||''} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
      <div className="admin-upload-grid"><label><span>Main leather photo {editing?'(optional replacement)':'(required)'}</span><input type="file" accept="image/*" onChange={e=>setMainFile(e.target.files?.[0]||null)}/>{mainFile&&<small>{mainFile.name}</small>}{editing&&form.main_photo&&!mainFile&&<img src={getLeatherImage(form.main_photo)} alt="Current main leather"/>}</label><label><span>Close-up photo (optional)</span><input type="file" accept="image/*" onChange={e=>setCloseupFile(e.target.files?.[0]||null)}/>{closeupFile&&<small>{closeupFile.name}</small>}{editing&&form.closeup_photo&&!closeupFile&&<img src={getLeatherImage(form.closeup_photo)} alt="Current close-up leather"/>}</label></div>
      <label className="admin-active"><input type="checkbox" checked={form.is_active!==false} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Show this article in the public catalogue</label>
      <button className="primary-link admin-save" type="submit" disabled={saving}><Save size={16}/>{saving?'Saving…':editing?'Save changes':'Add article'}</button>
    </form>
    <div className="admin-list"><h3>Existing articles ({products.length})</h3>{products.map(p=><div className="admin-row" key={p.leather_id}><div><strong>{p.article_name}</strong><span>{p.leather_id} · {p.color||'No colour'}</span></div><span className={p.is_active?'status-active':'status-inactive'}>{p.is_active?'Active':'Hidden'}</span><button onClick={()=>editProduct(p)}>Edit</button><button onClick={()=>toggleActive(p)}>{p.is_active?'Hide':'Publish'}</button></div>)}</div>
  </section>;
}
