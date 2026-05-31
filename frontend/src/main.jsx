import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Edit3,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    let detail = 'Something went wrong';
    try {
      const body = await response.json();
      detail = Array.isArray(body.detail) ? body.detail.map((item) => item.msg).join(', ') : body.detail || detail;
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

function App() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dashboard, setDashboard] = useState({ total_products: 0, total_customers: 0, total_orders: 0, low_stock_products: 0 });
  const [activeTab, setActiveTab] = useState('products');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', sku: '', price: '', quantity_in_stock: '' });
  const [customerForm, setCustomerForm] = useState({ full_name: '', email: '', phone_number: '' });
  const [orderForm, setOrderForm] = useState({ customer_id: '', product_id: '', quantity: 1 });

  const lowStock = useMemo(() => products.filter((product) => product.quantity_in_stock <= 5), [products]);

  const flash = (type, message) => {
    setNotice({ type, message });
    window.clearTimeout(window.__inventoryNotice);
    window.__inventoryNotice = window.setTimeout(() => setNotice(null), 4200);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [nextProducts, nextCustomers, nextOrders, nextDashboard] = await Promise.all([
        request('/products'),
        request('/customers'),
        request('/orders'),
        request('/dashboard'),
      ]);
      setProducts(nextProducts);
      setCustomers(nextCustomers);
      setOrders(nextOrders);
      setDashboard(nextDashboard);
    } catch (error) {
      flash('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submitProduct = async (event) => {
    event.preventDefault();
    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim(),
      price: Number(productForm.price),
      quantity_in_stock: Number(productForm.quantity_in_stock),
    };

    try {
      if (editingProductId) {
        await request(`/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(payload) });
        flash('success', 'Product updated');
      } else {
        await request('/products', { method: 'POST', body: JSON.stringify(payload) });
        flash('success', 'Product added');
      }
      setProductForm({ name: '', sku: '', price: '', quantity_in_stock: '' });
      setEditingProductId(null);
      await loadAll();
    } catch (error) {
      flash('error', error.message);
    }
  };

  const submitCustomer = async (event) => {
    event.preventDefault();
    try {
      await request('/customers', { method: 'POST', body: JSON.stringify(customerForm) });
      setCustomerForm({ full_name: '', email: '', phone_number: '' });
      flash('success', 'Customer added');
      await loadAll();
    } catch (error) {
      flash('error', error.message);
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    try {
      await request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: Number(orderForm.customer_id),
          items: [{ product_id: Number(orderForm.product_id), quantity: Number(orderForm.quantity) }],
        }),
      });
      setOrderForm({ customer_id: '', product_id: '', quantity: 1 });
      flash('success', 'Order created and inventory reduced');
      await loadAll();
    } catch (error) {
      flash('error', error.message);
    }
  };

  const deleteItem = async (kind, id) => {
    try {
      await request(`/${kind}/${id}`, { method: 'DELETE' });
      flash('success', `${kind.slice(0, -1)} deleted`);
      await loadAll();
    } catch (error) {
      flash('error', error.message);
    }
  };

  const startEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity_in_stock: product.quantity_in_stock,
    });
    setActiveTab('products');
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Operations Console</p>
          <h1>Inventory & Order Management</h1>
        </div>
        <button className="icon-button" onClick={loadAll} title="Refresh data" aria-label="Refresh data">
          <RefreshCw size={18} />
        </button>
      </section>

      {notice && (
        <div className={`notice ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notice.message}</span>
        </div>
      )}

      <section className="summary-grid" aria-label="Dashboard summary">
        <Metric icon={<Boxes />} label="Products" value={dashboard.total_products} />
        <Metric icon={<Users />} label="Customers" value={dashboard.total_customers} />
        <Metric icon={<ClipboardList />} label="Orders" value={dashboard.total_orders} />
        <Metric icon={<AlertCircle />} label="Low stock" value={dashboard.low_stock_products} />
      </section>

      <nav className="tabs" aria-label="Sections">
        {[
          ['products', 'Products', <Boxes size={17} />],
          ['customers', 'Customers', <Users size={17} />],
          ['orders', 'Orders', <ShoppingCart size={17} />],
        ].map(([id, label, icon]) => (
          <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="empty-state">Loading inventory data...</div>
      ) : (
        <>
          {activeTab === 'products' && (
            <TwoColumn>
              <Panel title={editingProductId ? 'Edit product' : 'Add product'} icon={<PackagePlus />}>
                <form onSubmit={submitProduct} className="form-grid">
                  <input required placeholder="Product name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                  <input required placeholder="SKU / code" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
                  <input required min="0" step="0.01" type="number" placeholder="Price" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                  <input required min="0" type="number" placeholder="Quantity in stock" value={productForm.quantity_in_stock} onChange={(e) => setProductForm({ ...productForm, quantity_in_stock: e.target.value })} />
                  <button type="submit">{editingProductId ? 'Save product' : 'Add product'}</button>
                  {editingProductId && (
                    <button type="button" className="secondary" onClick={() => { setEditingProductId(null); setProductForm({ name: '', sku: '', price: '', quantity_in_stock: '' }); }}>
                      Cancel
                    </button>
                  )}
                </form>
              </Panel>
              <Panel title="Product list" icon={<Boxes />}>
                <Table headers={['Name', 'SKU', 'Price', 'Stock', '']}>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.sku}</td>
                      <td>{money(product.price)}</td>
                      <td><span className={product.quantity_in_stock <= 5 ? 'badge warn' : 'badge'}>{product.quantity_in_stock}</span></td>
                      <td className="actions">
                        <button className="icon-button" onClick={() => startEditProduct(product)} title="Edit product" aria-label="Edit product"><Edit3 size={16} /></button>
                        <button className="icon-button danger" onClick={() => deleteItem('products', product.id)} title="Delete product" aria-label="Delete product"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </TwoColumn>
          )}

          {activeTab === 'customers' && (
            <TwoColumn>
              <Panel title="Add customer" icon={<UserPlus />}>
                <form onSubmit={submitCustomer} className="form-grid">
                  <input required placeholder="Full name" value={customerForm.full_name} onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })} />
                  <input required type="email" placeholder="Email address" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  <input required placeholder="Phone number" value={customerForm.phone_number} onChange={(e) => setCustomerForm({ ...customerForm, phone_number: e.target.value })} />
                  <button type="submit">Add customer</button>
                </form>
              </Panel>
              <Panel title="Customer list" icon={<Users />}>
                <Table headers={['Name', 'Email', 'Phone', '']}>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{customer.full_name}</td>
                      <td>{customer.email}</td>
                      <td>{customer.phone_number}</td>
                      <td className="actions">
                        <button className="icon-button danger" onClick={() => deleteItem('customers', customer.id)} title="Delete customer" aria-label="Delete customer"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </TwoColumn>
          )}

          {activeTab === 'orders' && (
            <TwoColumn>
              <Panel title="Create order" icon={<ShoppingCart />}>
                <form onSubmit={submitOrder} className="form-grid">
                  <select required value={orderForm.customer_id} onChange={(e) => setOrderForm({ ...orderForm, customer_id: e.target.value })}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
                  </select>
                  <select required value={orderForm.product_id} onChange={(e) => setOrderForm({ ...orderForm, product_id: e.target.value })}>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name} ({product.quantity_in_stock} in stock)</option>
                    ))}
                  </select>
                  <input required min="1" type="number" placeholder="Quantity" value={orderForm.quantity} onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })} />
                  <button type="submit">Create order</button>
                </form>
                <div className="low-stock">
                  <strong>Low stock products</strong>
                  {lowStock.length ? lowStock.map((product) => <span key={product.id}>{product.name}: {product.quantity_in_stock}</span>) : <span>None</span>}
                </div>
              </Panel>
              <Panel title="Order history" icon={<ClipboardList />}>
                <div className="order-list">
                  {orders.map((order) => (
                    <article className="order-item" key={order.id}>
                      <div>
                        <strong>Order #{order.id}</strong>
                        <span>{order.customer.full_name} • {money(order.total_amount)}</span>
                      </div>
                      <ul>
                        {order.items.map((item) => <li key={item.id}>{item.product.name} x {item.quantity}</li>)}
                      </ul>
                      <button className="icon-button danger" onClick={() => deleteItem('orders', order.id)} title="Delete order" aria-label="Delete order"><Trash2 size={16} /></button>
                    </article>
                  ))}
                  {!orders.length && <div className="empty-state">No orders yet</div>}
                </div>
              </Panel>
            </TwoColumn>
          )}
        </>
      )}
    </main>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <div className="metric-icon">{React.cloneElement(icon, { size: 21 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <h2>{React.cloneElement(icon, { size: 19 })}{title}</h2>
      {children}
    </section>
  );
}

function TwoColumn({ children }) {
  return <section className="content-grid">{children}</section>;
}

function Table({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
