import React, { useEffect, useState, useCallback } from 'react';
import { listItems, listAllItems, archiveItem, restoreItem } from '../api/itemsApi';
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

  const [items, setItems] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', item }
  const [actionError, setActionError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = isLibrarian && showArchived
        ? await listAllItems()
        : await listItems();
      setItems(fetched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isLibrarian, showArchived]);

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

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Catalogue</h1>
        {isLibrarian && (
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Add item
          </button>
        )}
      </div>

      {isLibrarian && (
        <div className="catalogue-toolbar">
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived items
          </label>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          {showArchived ? 'No items in the catalogue yet.' : 'No active items.'}
        </div>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Category</th>
              {isLibrarian && <th>Status</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><code>{item.code}</code></td>
                <td>{item.title}</td>
                <td>{item.category}</td>
                {isLibrarian && (
                  <td>
                    <span className={`badge ${item.archived ? 'badge-archived' : 'badge-active'}`}>
                      {item.archived ? 'Archived' : 'Active'}
                    </span>
                  </td>
                )}
                <td>
                  <div className="actions">
                    {!isLibrarian && (
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
            ))}
          </tbody>
        </table>
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
