import React, { useState } from 'react';
import { createItem, updateItem } from '../api/itemsApi';

/**
 * ItemFormModal - create or edit a catalogue item.
 *
 * Props:
 *   item         - existing item to edit, or null for create mode
 *   onSave(item) - called with the saved item on success
 *   onClose()    - called when the modal should close
 */
export default function ItemFormModal({ item, onSave, onClose }) {
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title ?? '',
    category: item?.category ?? '',
    code: item?.code ?? '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const saved = isEdit
        ? await updateItem(item.id, form)
        : await createItem(form);
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{isEdit ? 'Edit item' : 'Add item'}</h2>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="item-title">Title</label>
            <input
              id="item-title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="e.g. DSLR Camera"
            />
          </div>

          <div className="form-group">
            <label htmlFor="item-category">Category</label>
            <input
              id="item-category"
              name="category"
              type="text"
              value={form.category}
              onChange={handleChange}
              required
              placeholder="e.g. Photography"
            />
          </div>

          <div className="form-group">
            <label htmlFor="item-code">Code</label>
            <input
              id="item-code"
              name="code"
              type="text"
              value={form.code}
              onChange={handleChange}
              required
              placeholder="e.g. CAM-001"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
