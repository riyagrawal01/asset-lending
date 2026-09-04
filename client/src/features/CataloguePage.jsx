import React, { useEffect, useState, useCallback, useRef } from 'react';
import { listItems, listAllItems, archiveItem, restoreItem, importCSV, exportOnLoan } from '../api/itemsApi';
import { requestLoan } from '../api/loansApi';
import ItemFormModal from './ItemFormModal';

/**
 * CataloguePage - main catalogue view.
 *
 * Props:
 *   user - the current user object { id, name, email, role }
 */
export default function CataloguePage({ user }) {
  const isLibrarian = user.role === 'LIBRARIAN';
  const isAdmin = user.role === 'ADMIN';
  const canViewArchived = isLibrarian || isAdmin;

  const [items, setItems] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', item }
  const [actionError, setActionError] = useState(null);

  // Catalogue search — client-side filter over the fetched item list
  const [catalogueSearch, setCatalogueSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // CSV import state
  const fileInputRef = useRef(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = canViewArchived && showArchived
        ? await listAllItems()
        : await listItems();
      setItems(fetched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canViewArchived, showArchived]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleArchive(item) {
    setActionError(null);
    try {
      await archiveItem(item.id);
      fetchItems();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleRestore(item) {
    setActionError(null);
    try {
      await restoreItem(item.id);
      fetchItems();
    } catch (err) {
      setActionError(err.message);
    }
  }

  function handleSaved() {
    setModal(null);
    fetchItems();
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setActionError(null);
    try {
      const text = await file.text();
      const result = await importCSV(text);
      setImportResult(result);
      fetchItems();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-imported if needed.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleExport() {
    try {
      await exportOnLoan();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const displayedItems = catalogueSearch.trim()
    ? (() => {
        const q = catalogueSearch.trim().toLowerCase();
        return items.filter(item =>
          item.title?.toLowerCase().includes(q) ||
          item.code?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q)
        );
      })()
    : items;

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Catalogue</h1>
        {isLibrarian && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              + Add item
            </button>
            {/* Hidden file input for CSV import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="Import items from CSV (title, category, code)"
            >
              {importing ? 'Importing…' : '↑ Import CSV'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              title="Download currently issued loans as CSV"
            >
              ↓ Export on-loan
            </button>
          </div>
        )}
      </div>

      <div className="catalogue-toolbar" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search by title, code or category…"
            value={catalogueSearch}
            onChange={e => { setCatalogueSearch(e.target.value); setPage(1); }}
            style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem', width: '100%', maxWidth: '400px' }}
          />
          {catalogueSearch && (
            <button
              className="btn btn-secondary"
              onClick={() => { setCatalogueSearch(''); setPage(1); }}
              style={{ fontSize: '0.8rem' }}
            >
              Clear
            </button>
          )}
        </div>
        {canViewArchived && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
            />
            Show archived items
          </label>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}

      {importResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <strong>Import complete:</strong>{' '}
          {importResult.imported} of {importResult.total} rows imported
          {importResult.failed > 0 && (
            <span style={{ color: 'var(--color-danger)' }}>, {importResult.failed} failed</span>
          )}.
          {importResult.errors.map(e => (
            <div key={e.row} style={{ color: 'var(--color-danger)' }}>Row {e.row}: {e.reason}</div>
          ))}
          <button className="btn btn-secondary" style={{ marginTop: '0.4rem' }} onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading...</p>
      ) : displayedItems.length === 0 ? (
        <div className="empty-state">
          {catalogueSearch
            ? 'No items match your search.'
            : showArchived ? 'No items in the catalogue yet.' : 'No active items.'}
        </div>
      ) : (
        <>
          <table className="item-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Category</th>
                {canViewArchived && <th>Status</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedItems = displayedItems.slice((page - 1) * LIMIT, page * LIMIT);
                return paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.code}</code></td>
                    <td>{item.title}</td>
                    <td>{item.category}</td>
                    {canViewArchived && (
                      <td>
                        <span className={`badge ${item.archived ? 'badge-archived' : 'badge-active'}`}>
                          {item.archived ? 'Archived' : 'Active'}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="actions">
                        {user.role === 'MEMBER' && (
                          <button 
                            className="btn btn-primary"
                            onClick={async () => {
                              try {
                                await requestLoan(item.id);
                                alert('Loan requested successfully.');
                              } catch (err) {
                                setActionError(err.message);
                              }
                            }}
                          >
                            Request
                          </button>
                        )}
                        {isLibrarian && (
                          <>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setModal({ mode: 'edit', item })}
                            >
                              Edit
                            </button>
                            {item.archived ? (
                              <button
                                className="btn btn-success"
                                onClick={() => handleRestore(item)}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                className="btn btn-danger"
                                onClick={() => handleArchive(item)}
                              >
                                Archive
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {/* Pagination controls */}
          {(() => {
            const totalPages = Math.ceil(displayedItems.length / LIMIT);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >← Prev</button>
                <span>
                  Page {page} of {totalPages || 1}
                  {' '}·{' '}
                  {displayedItems.length} item{displayedItems.length !== 1 ? 's' : ''} total
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= (totalPages || 1)}
                >Next →</button>
              </div>
            );
          })()}
        </>
      )}

      {modal && (
        <ItemFormModal
          item={modal.mode === 'edit' ? modal.item : null}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
