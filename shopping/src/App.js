import { useEffect, useMemo, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const PRODUCT_PLACEHOLDER = '/product-placeholder.svg';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const classes = (...values) => values.filter(Boolean).join(' ');

async function request(path, options = {}) {
  const token = localStorage.getItem('keep-token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('keep-user')); } catch { return null; } });
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('keep-cart') || '[]'); } catch { return []; } });
  const [page, setPage] = useState('shop');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authRole, setAuthRole] = useState('buyer');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '' });
  const [productForm, setProductForm] = useState({ name: '', category: 'Home', price: '', stock: '', image: '', description: '' });
  const [orders, setOrders] = useState([]);
  const [shippingAddress, setShippingAddress] = useState('');

  const loadProducts = async () => { try { setProducts(await request(user?.role === 'seller' ? '/products/mine' : '/products')); } catch (error) { setNotice(error.message); } };
  const loadOrders = async () => { try { setOrders(await request('/orders/mine')); } catch (error) { setNotice(error.message); } };
  useEffect(() => {
    loadProducts();

    // Refresh stock while this tab is open so buyer carts and seller inventory stay current.
    const refreshWhileVisible = () => {
      if (document.visibilityState === 'visible') loadProducts();
    };
    const interval = window.setInterval(refreshWhileVisible, 15000);
    document.addEventListener('visibilitychange', refreshWhileVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, [user?.role]);
  useEffect(() => { localStorage.setItem('keep-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!products.length || user?.role !== 'buyer') return;
    setCart((items) => items.map((item) => {
      const latestProduct = products.find((product) => product._id === item._id);
      return latestProduct ? { ...item, stock: latestProduct.stock } : item;
    }));
  }, [products, user?.role]);
  useEffect(() => { if (user && (page === 'orders' || page === 'dashboard')) loadOrders(); }, [page, user]);

  const filtered = useMemo(() => products.filter((item) => (category === 'All' || item.category === category) && `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [products, query, category]);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const categories = ['All', ...new Set(products.map((product) => product.category).filter(Boolean))];
  const flash = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500); };
  const updateForm = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const updateProduct = (key) => (event) => setProductForm({ ...productForm, [key]: event.target.value });

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true);
    try {
      const endpoint = authMode === 'signup' ? '/auth/signup' : '/auth/login';
      const result = await request(endpoint, { method: 'POST', body: JSON.stringify({ ...form, role: authRole }) });
      localStorage.setItem('keep-token', result.token); localStorage.setItem('keep-user', JSON.stringify(result.user));
      setUser(result.user); setPage(result.user.role === 'seller' ? 'dashboard' : 'shop'); setForm({ name: '', email: '', password: '', phone: '', address: '' });
      setShippingAddress(result.user.address || '');
      flash(`Welcome${result.user.name ? `, ${result.user.name}` : ''}!`);
    } catch (error) { flash(error.message); } finally { setBusy(false); }
  }

  function logout() { localStorage.removeItem('keep-token'); localStorage.removeItem('keep-user'); setUser(null); setPage('shop'); flash('You are signed out.'); }
  function addToCart(product) {
    if (Number(product.stock) <= 0) { flash('This product is sold out right now.'); return; }
    if (!user || user.role !== 'buyer') { flash('Sign in as a customer to add items to your bag.'); setPage('auth'); setAuthRole('buyer'); setAuthMode('login'); return; }
    setCart((items) => { const found = items.find((item) => item._id === product._id); if (found) return items.map((item) => item._id === product._id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item); return [...items, { ...product, qty: 1 }]; });
    flash(`${product.name} added to your bag.`);
  }
  function changeQty(id, amount) { setCart((items) => items.map((item) => item._id === id ? { ...item, qty: Math.min(item.stock, item.qty + amount) } : item).filter((item) => item.qty > 0)); }

  async function placeOrder(event) {
    event.preventDefault(); if (!cart.length) return;
    let address = shippingAddress.trim();
    if (!address) { address = window.prompt('Enter your delivery address (street, city and postal code):') || ''; if (!address.trim()) return; setShippingAddress(address); }
    setBusy(true);
    try { await request('/orders', { method: 'POST', body: JSON.stringify({ shippingAddress: address, items: cart.map(({ _id, qty }) => ({ product: _id, quantity: qty })) }) }); setCart([]); setPage('orders'); flash('Order placed. Your sellers have been notified.'); }
    catch (error) { flash(error.message); } finally { setBusy(false); }
  }

  async function addProduct(event) {
    event.preventDefault(); setBusy(true);
    try { await request('/products', { method: 'POST', body: JSON.stringify({ ...productForm, price: Number(productForm.price), stock: Number(productForm.stock) }) }); setProductForm({ name: '', category: 'Home', price: '', stock: '', image: '', description: '' }); await loadProducts(); setPage('inventory'); flash('Your product is live in the store.'); }
    catch (error) { flash(error.message); } finally { setBusy(false); }
  }

  async function restockProduct(product) {
    const answer = window.prompt(`How many units of ${product.name} would you like to add?`, '10');
    if (answer === null) return;
    const quantity = Number(answer);
    if (!Number.isInteger(quantity) || quantity < 1) { flash('Enter a whole number greater than zero.'); return; }
    try { await request(`/products/${product._id}/stock`, { method: 'PATCH', body: JSON.stringify({ quantity }) }); await loadProducts(); flash(`${product.name} restocked.`); } catch (error) { flash(error.message); }
  }

  async function deleteProduct(id) { try { await request(`/products/${id}`, { method: 'DELETE' }); await loadProducts(); flash('Product removed from your store.'); } catch (error) { flash(error.message); } }

  const button = 'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50';
  const input = 'mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100';
  const ownedProducts = products.filter((product) => String(product.seller?._id || product.seller) === String(user?._id));

  return <div className="min-h-screen bg-[#faf9f6] text-stone-900">
    <div className="bg-emerald-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-emerald-50">Thoughtful finds, from independent sellers · Free shipping over ₹2,000</div>
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-[#faf9f6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <button onClick={() => setPage(user?.role === 'seller' ? 'dashboard' : 'shop')} className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-800 text-lg text-white">m</span>morrow<span className="text-emerald-800">.</span></button>
        <nav className="hidden items-center gap-8 md:flex">
          {user?.role === 'seller' ? <><NavButton active={page === 'dashboard'} onClick={() => setPage('dashboard')}>Overview</NavButton><NavButton active={page === 'inventory'} onClick={() => setPage('inventory')}>My products</NavButton><NavButton active={page === 'new-product'} onClick={() => setPage('new-product')}>Add a product</NavButton><NavButton active={page === 'orders'} onClick={() => setPage('orders')}>Orders</NavButton></> : <><NavButton active={page === 'shop'} onClick={() => setPage('shop')}>Shop</NavButton><NavButton active={page === 'orders'} onClick={() => user ? setPage('orders') : (setPage('auth'), setAuthRole('buyer'))}>My orders</NavButton></>}
        </nav>
        <div className="flex items-center gap-2"><button onClick={() => setPage(user?.role === 'buyer' ? 'cart' : 'auth')} className="relative rounded-full p-3 hover:bg-stone-100" aria-label="Shopping bag"><span className="text-lg">♧</span>{cart.length > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-800 px-1 text-[10px] text-white">{cart.length}</span>}</button>
          {user ? <button onClick={logout} className={`${button} bg-stone-900 !px-4 !py-2.5 text-white`}>{user.name?.split(' ')[0]} · Sign out</button> : <button onClick={() => { setPage('auth'); setAuthMode('login'); }} className={`${button} bg-emerald-800 !px-5 !py-2.5 text-white hover:bg-emerald-900`}>Sign in</button>}
        </div>
      </div>
      {user?.role === 'seller' && <div className="flex gap-2 overflow-x-auto border-t border-stone-200 px-5 py-2 md:hidden"><NavButton onClick={() => setPage('dashboard')}>Overview</NavButton><NavButton onClick={() => setPage('inventory')}>Products</NavButton><NavButton onClick={() => setPage('new-product')}>Add product</NavButton><NavButton onClick={() => setPage('orders')}>Orders</NavButton></div>}
    </header>

    {notice && <div className="fixed right-4 top-24 z-50 max-w-sm rounded-2xl bg-stone-900 px-5 py-4 text-sm text-white shadow-xl">{notice}</div>}

    <main>
      {(page === 'shop' || (page === 'dashboard' && user?.role !== 'seller')) && <>
        <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-12 pt-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
          <div className="py-5"><p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-emerald-800">The good things edit · No. 04</p><h1 className="max-w-2xl text-5xl font-semibold leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-7xl">A little more <span className="font-serif italic text-emerald-800">meaning</span> in every day.</h1><p className="mt-6 max-w-lg text-base leading-7 text-stone-600">Discover considered pieces from independent makers. Made to be used, loved, and kept.</p><button onClick={() => document.getElementById('collection').scrollIntoView({ behavior: 'smooth' })} className={`${button} mt-8 bg-emerald-800 text-white hover:bg-emerald-900`}>Explore the collection <span className="ml-3">↘</span></button><div className="mt-10 flex items-center gap-3 text-xs text-stone-500"><span className="flex -space-x-2"><i className="h-7 w-7 rounded-full border-2 border-[#faf9f6] bg-rose-200"/><i className="h-7 w-7 rounded-full border-2 border-[#faf9f6] bg-amber-200"/><i className="h-7 w-7 rounded-full border-2 border-[#faf9f6] bg-emerald-200"/></span>Local makers, loved by 12,000+ shoppers</div></div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#e9dfcc] sm:min-h-[480px]"><img className="absolute h-full w-full object-cover" src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1400&q=85" alt="Warm, carefully designed living space"/><div className="absolute inset-0 bg-gradient-to-t from-stone-950/55 via-transparent to-transparent"/><div className="absolute bottom-7 left-7 text-white"><p className="text-xs uppercase tracking-[0.2em]">Made for slow mornings</p><p className="mt-2 text-2xl font-semibold">Bring calm home.</p></div><div className="absolute right-6 top-6 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold">The home edit · 2026</div></div>
        </section>
        <section id="collection" className="mx-auto max-w-7xl px-5 pb-20 lg:px-8"><div className="flex flex-col justify-between gap-6 border-t border-stone-200 py-8 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Made with intention</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">The collection</h2></div><div className="flex flex-col gap-3 sm:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find something lovely..." className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm outline-none focus:border-emerald-700"/><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm">{categories.map((name) => <option key={name}>{name}</option>)}</select></div></div>
          {filtered.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">{filtered.map((product) => <ProductCard key={product._id} product={product} onAdd={addToCart} money={money}/>) }</div> : <p className="rounded-3xl bg-white p-10 text-center text-stone-500">No pieces match that search yet. Try another category.</p>}
        </section>
        <section className="bg-emerald-950 px-5 py-14 text-center text-white"><p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Have something special to share?</p><h2 className="mx-auto mt-3 max-w-xl text-3xl font-semibold">Your work deserves a place on our shelves.</h2><button onClick={() => { setPage('auth'); setAuthMode('signup'); setAuthRole('seller'); }} className={`${button} mt-6 bg-white text-emerald-950`}>Become a seller</button></section>
      </>}

      {page === 'auth' && <section className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-2 lg:py-20"><div className="hidden min-h-[580px] rounded-[2rem] bg-cover bg-center p-10 text-white lg:flex lg:flex-col lg:justify-end" style={{ backgroundImage: "linear-gradient(0deg,rgba(0,0,0,.62),transparent 65%),url('https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1100&q=85')" }}><p className="text-xs uppercase tracking-[0.2em]">A marketplace with heart</p><h2 className="mt-3 text-4xl font-semibold">Good things find good people.</h2></div><div className="flex flex-col justify-center"><button onClick={() => setPage('shop')} className="mb-8 self-start text-sm text-stone-500">← Back to the collection</button><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">{authMode === 'login' ? 'Welcome back' : 'Join our community'}</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{authMode === 'login' ? 'Sign in to keep.' : 'Create your account.'}</h1><p className="mt-3 text-sm text-stone-500">{authMode === 'login' ? 'Your next favourite thing is waiting.' : 'Shop independent or open your own little corner.'}</p><div className="mt-7 grid grid-cols-2 rounded-full bg-stone-100 p-1"><button className={classes('rounded-full py-2.5 text-sm font-medium', authRole === 'buyer' ? 'bg-white shadow-sm' : 'text-stone-500')} onClick={() => setAuthRole('buyer')}>I’m shopping</button><button className={classes('rounded-full py-2.5 text-sm font-medium', authRole === 'seller' ? 'bg-white shadow-sm' : 'text-stone-500')} onClick={() => setAuthRole('seller')}>I’m a seller</button></div><form onSubmit={submitAuth} className="mt-6 space-y-4">{authMode === 'signup' && <Field label="Your name" value={form.name} onChange={updateForm('name')} placeholder="Alex Morgan" required inputClass={input}/>}<Field label="Email address" type="email" value={form.email} onChange={updateForm('email')} placeholder="you@example.com" required inputClass={input}/>{authMode === 'signup' && <Field label="Phone (optional)" value={form.phone} onChange={updateForm('phone')} placeholder="+91 98765 43210" inputClass={input}/>}<Field label="Password" type="password" value={form.password} onChange={updateForm('password')} placeholder="At least 8 characters" required inputClass={input}/><button disabled={busy} className={`${button} w-full bg-emerald-800 text-white hover:bg-emerald-900`}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button></form><p className="mt-5 text-center text-sm text-stone-500">{authMode === 'login' ? 'New around here?' : 'Already have an account?'} <button className="font-semibold text-emerald-800" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p></div></section>}

      {page === 'cart' && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Almost yours</p><h1 className="mt-2 text-4xl font-semibold">Your bag <span className="text-stone-400">({cart.length})</span></h1>{cart.length ? <div className="mt-9 grid gap-10 lg:grid-cols-[1fr_370px]"><div className="divide-y divide-stone-200">{cart.map((item) => <div key={item._id} className="flex gap-5 py-5"><img src={item.image || PRODUCT_PLACEHOLDER} onError={handleProductImageError} alt={item.name} className="h-28 w-24 rounded-xl object-cover"/><div className="flex flex-1 flex-col justify-between sm:flex-row"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs text-stone-500">{item.category}</p><button onClick={() => setCart((items) => items.filter((x) => x._id !== item._id))} className="mt-3 text-xs text-stone-400 underline">Remove</button></div><div className="mt-3 flex items-center gap-3 sm:mt-0"><div className="flex items-center rounded-full border border-stone-200"><button onClick={() => changeQty(item._id, -1)} className="px-3 py-2">−</button><span className="text-sm">{item.qty}</span><button onClick={() => changeQty(item._id, 1)} className="px-3 py-2">+</button></div><b>{money(item.price * item.qty)}</b></div></div></div>)}</div><form onSubmit={placeOrder} className="h-fit rounded-3xl bg-white p-7 shadow-sm"><h2 className="text-xl font-semibold">Order summary</h2><div className="mt-6 flex justify-between text-sm text-stone-500"><span>Subtotal</span><span>{money(total)}</span></div><div className="mt-3 flex justify-between text-sm text-stone-500"><span>Shipping</span><span>{total >= 2000 ? 'Free' : money(99)}</span></div><div className="mt-5 border-t border-stone-100 pt-5 flex justify-between font-semibold"><span>Total</span><span>{money(total + (total >= 2000 ? 0 : 99))}</span></div><button disabled={busy} className={`${button} mt-6 w-full bg-emerald-800 text-white`}>{busy ? 'Placing order…' : 'Place order'}</button><p className="mt-3 text-center text-xs text-stone-400">Secure checkout · Payment on delivery</p></form></div> : <div className="mt-10 rounded-3xl bg-white p-12 text-center"><p className="text-4xl">♡</p><h2 className="mt-4 text-xl font-semibold">Your bag is taking a little break.</h2><button className={`${button} mt-5 bg-emerald-800 text-white`} onClick={() => setPage('shop')}>Find something lovely</button></div>}</section>}

      {page === 'dashboard' && user?.role === 'seller' && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Seller studio</p><h1 className="mt-2 text-4xl font-semibold">Good morning, {user.name?.split(' ')[0]}.</h1><p className="mt-2 text-stone-500">Here’s how your shop is doing.</p><div className="mt-9 grid gap-4 sm:grid-cols-3"><Stat label="Your products" value={ownedProducts.length}/><Stat label="Orders to date" value={orders.length}/><Stat label="Store status" value="Open"/></div><div className="mt-10 flex items-center justify-between"><h2 className="text-2xl font-semibold">Your latest pieces</h2><button onClick={() => setPage('new-product')} className={`${button} bg-emerald-800 text-white`}>+ Add product</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{ownedProducts.slice(0, 4).map((p) => <div key={p._id} className="rounded-2xl bg-white p-3"><img src={p.image || PRODUCT_PLACEHOLDER} onError={handleProductImageError} className="h-40 w-full rounded-xl object-cover" alt={p.name}/><div className="flex justify-between pt-3"><span className="font-medium">{p.name}</span><span>{money(p.price)}</span></div></div>)}</div></section>}

      {page === 'inventory' && user?.role === 'seller' && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Seller studio</p><h1 className="mt-2 text-4xl font-semibold">My products</h1></div><button onClick={() => setPage('new-product')} className={`${button} bg-emerald-800 text-white`}>+ Add a product</button></div><div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm"><div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b px-6 py-4 text-xs font-semibold uppercase tracking-wide text-stone-400 md:grid"><span>Product</span><span>Price</span><span>In stock</span><span>Category</span><span>Action</span></div>{ownedProducts.map((p) => <div key={p._id} className="grid gap-3 border-b border-stone-100 p-5 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-6"><div className="flex items-center gap-3"><img src={p.image || PRODUCT_PLACEHOLDER} onError={handleProductImageError} alt="" className="h-14 w-14 rounded-xl object-cover"/><div><b>{p.name}</b><p className="text-xs text-stone-500 md:hidden">{p.category} - {p.stock} in stock</p></div></div><span>{money(p.price)}</span><span>{p.stock} units</span><span>{p.category}</span><div className="flex flex-wrap gap-3"><button onClick={() => restockProduct(p)} className="text-sm font-medium text-emerald-800">Restock</button><button onClick={() => deleteProduct(p._id)} className="text-sm text-red-600">Remove</button></div></div>)}{!ownedProducts.length && <p className="p-10 text-center text-stone-500">No products yet. Add the first one to your store.</p>}</div></section>}

      {page === 'new-product' && user?.role === 'seller' && <section className="mx-auto max-w-3xl px-5 py-12 lg:py-16"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Seller studio</p><h1 className="mt-2 text-4xl font-semibold">Add a new piece.</h1><p className="mt-2 text-stone-500">A clear photo and a little story help your work find its people.</p><form onSubmit={addProduct} className="mt-8 grid gap-5 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-9"><Field label="Product name" value={productForm.name} onChange={updateProduct('name')} placeholder="Hand-thrown ceramic mug" required inputClass={input}/><label className="text-sm font-medium">Category<select value={productForm.category} onChange={updateProduct('category')} className={input}>{['Home','Fashion','Accessories','Beauty','Art','Food','Other'].map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Price (₹)" type="number" value={productForm.price} onChange={updateProduct('price')} placeholder="1200" required inputClass={input}/><Field label="Available quantity" type="number" value={productForm.stock} onChange={updateProduct('stock')} placeholder="10" required inputClass={input}/><label className="text-sm font-medium sm:col-span-2">Image URL<input type="url" value={productForm.image} onChange={updateProduct('image')} placeholder="https://…" className={input}/></label><label className="text-sm font-medium sm:col-span-2">Tell us about it<textarea required rows="4" value={productForm.description} onChange={updateProduct('description')} placeholder="Materials, process, what makes it special…" className={input}/></label><div className="flex gap-3 sm:col-span-2"><button disabled={busy} className={`${button} bg-emerald-800 text-white`}>{busy ? 'Publishing…' : 'Publish product'}</button><button type="button" onClick={() => setPage('inventory')} className={`${button} bg-stone-100`}>Cancel</button></div></form></section>}

      {page === 'orders' && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">{user?.role === 'seller' ? 'Seller studio' : 'Your account'}</p><h1 className="mt-2 text-4xl font-semibold">{user?.role === 'seller' ? 'Incoming orders' : 'Your orders'}</h1>{!user ? <div className="mt-8 rounded-3xl bg-white p-10 text-center">Sign in to see your orders.<button onClick={() => setPage('auth')} className="ml-2 text-emerald-800 underline">Sign in</button></div> : <div className="mt-8 space-y-4">{orders.map((order) => <article key={order._id} className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-stone-400">Order {order._id.slice(-8).toUpperCase()}</p><p className="mt-1 font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p></div><span className="h-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{order.status}</span><b>{money(order.total)}</b></div><div className="mt-5 divide-y divide-stone-100">{order.items.map((item, index) => <div className="flex items-center gap-4 py-3" key={`${item.product?._id || index}-${index}`}><img src={item.product?.image || PRODUCT_PLACEHOLDER} onError={handleProductImageError} alt="" className="h-14 w-14 rounded-xl object-cover"/><div className="flex-1"><p className="font-medium">{item.product?.name || 'Product'}</p><p className="text-xs text-stone-500">Qty {item.quantity}{user.role === 'seller' && item.seller?.name ? ` · ${item.seller.name}` : ''}</p></div><span className="text-sm">{money(item.price * item.quantity)}</span></div>)}</div></article>)}{orders.length === 0 && <p className="rounded-3xl bg-white p-10 text-center text-stone-500">No orders to show yet.</p>}</div>}</section>}
    </main>
    <footer className="border-t border-stone-200 bg-white px-5 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs text-stone-500 sm:flex-row lg:px-8"><span className="font-bold text-stone-800">morrow<span className="text-emerald-800">.</span> Thoughtful things, kept longer.</span><span>Made with care · © Morrow Market 2026</span></div></footer>
  </div>;
}

function handleProductImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = PRODUCT_PLACEHOLDER;
}

function ProductCard({ product, onAdd, money }) {
  const soldOut = Number(product.stock) <= 0;
  return <article className="group">
    <button disabled={soldOut} onClick={() => onAdd(product)} className={classes('relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-stone-100 text-left', soldOut && 'cursor-not-allowed')}>
      <img src={product.image || PRODUCT_PLACEHOLDER} onError={handleProductImageError} alt={product.name} className={classes('h-full w-full object-cover transition duration-500', soldOut ? 'blur-[3px] opacity-60' : 'group-hover:scale-105')}/>
      {soldOut && <span className="absolute inset-0 grid place-items-center bg-stone-900/15 text-sm font-semibold uppercase tracking-[0.18em] text-white">Sold out</span>}
      <span className={classes('absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full text-xl shadow transition', soldOut ? 'bg-stone-200 text-stone-400' : 'bg-white group-hover:bg-emerald-800 group-hover:text-white')}>{soldOut ? '' : '+'}</span>
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">{product.category}</span>
    </button>
    <div className="flex justify-between gap-2 pt-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-stone-500">{product.seller?.name ? 'by ' + product.seller.name : 'Independent maker'}</p></div><p className="whitespace-nowrap text-sm font-semibold">{money(product.price)}</p></div>
    <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500">{product.description}</p>
  </article>;
}

function NavButton({ children, active, onClick }) { return <button onClick={onClick} className={classes('whitespace-nowrap text-sm transition hover:text-emerald-800', active ? 'font-semibold text-emerald-800' : 'text-stone-600')}>{children}</button>; }
function Field({ label, inputClass, ...props }) { return <label className="block text-sm font-medium">{label}<input className={inputClass} {...props}/></label>; }
function Stat({ label, value }) { return <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>; }

export default App;
