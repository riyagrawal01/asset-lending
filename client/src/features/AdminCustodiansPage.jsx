import React, { useState, useEffect } from 'react';
import { listItems } from '../api/itemsApi';
import { getCustodians, setCustodians } from '../api/adminApi';

export default function AdminCustodiansPage() {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  
  const [librarians, setLibrarians] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [error, setError] = useState(null);
  const [panelError, setPanelError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      loadCustodians(selectedItemId);
    } else {
      setLibrarians([]);
      setSelectedIds(new Set());
      setSuccessMsg(null);
      setSearch('');
    }
  }, [selectedItemId]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await listItems();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustodians(itemId) {
    setPanelLoading(true);
    setPanelError(null);
    setSuccessMsg(null);
    try {
      const libs = await getCustodians(itemId);
      setLibrarians(libs);
      setSelectedIds(new Set(libs.filter(l => l.isCustodian).map(l => l.id)));
    } catch (err) {
      setPanelError(err.message);
    } finally {
      setPanelLoading(false);
    }
  }

  function handleToggle(libId) {
    const next = new Set(selectedIds);
    if (next.has(libId)) next.delete(libId);
    else next.add(libId);
    setSelectedIds(next);
  }

  async function handleSave() {
    if (!selectedItemId) return;
    setSaving(true);
    setPanelError(null);
    setSuccessMsg(null);
    try {
      await setCustodians(selectedItemId, Array.from(selectedIds));
      setSuccessMsg('Custodians updated successfully.');
      await loadCustodians(selectedItemId);
    } catch (err) {
      setPanelError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Revert to current server state
    if (selectedItemId) {
      loadCustodians(selectedItemId);
    }
  }

  const selectedItem = items.find(i => i.id === selectedItemId);
  const filteredLibrarians = librarians.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    l.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Manage Custodians</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Select Item
        </label>
        {loading ? (
          <p>Loading items...</p>
        ) : (
          <select
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '1rem', width: '100%', maxWidth: '400px' }}
          >
            <option value="">-- Choose an item --</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>{i.title} ({i.code})</option>
            ))}
          </select>
        )}
      </div>

      {selectedItem && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Custodians — {selectedItem.title}
          </h2>

          {panelError && <div className="error-banner">{panelError}</div>}
          {successMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {successMsg}
            </div>
          )}

          {panelLoading ? (
            <p>Loading librarians...</p>
          ) : (
            <div style={{ maxWidth: '400px' }}>
              <input
                type="text"
                placeholder="Search librarians..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', marginBottom: '1rem', fontSize: '0.875rem' }}
              />

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', background: '#fff', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                {filteredLibrarians.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>No librarians found.</p>
                ) : (
                  filteredLibrarians.map(lib => (
                    <label key={lib.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lib.id)}
                        onChange={() => handleToggle(lib.id)}
                      />
                      <span>
                        {lib.name}
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{lib.email}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
