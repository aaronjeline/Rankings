import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';

function SortableItem({ item, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RankingCard item={item} onDelete={onDelete} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function RankingCard({ item, onDelete, dragHandleProps, rank }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: '#fff',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '8px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      gap: '10px',
      userSelect: 'none',
    }}>
      {/* Drag handle */}
      <span
        {...(dragHandleProps || {})}
        className="drag-handle"
        style={{ cursor: dragHandleProps ? undefined : 'default' }}
        title="Drag to reorder"
      >
        ⠿
      </span>

      {rank !== undefined && (
        <span style={{
          minWidth: '28px',
          fontWeight: 700,
          color: rank === 0 ? '#f59e0b' : rank === 1 ? '#9ca3af' : rank === 2 ? '#b45309' : '#c4c4c4',
          fontSize: '1rem',
        }}>
          #{rank + 1}
        </span>
      )}

      <span style={{ flex: 1, fontSize: '1rem', wordBreak: 'break-word' }}>{item.text}</span>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="delete-btn"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

export function HelpMeAddWizard({ items, onComplete, onCancel }) {
  const [phase, setPhase] = useState('feeling'); // 'feeling' | 'comparing' | 'inserting'
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(items.length);
  const [mid, setMid] = useState(0);
  const [wizardError, setWizardError] = useState('');

  function handleFeeling(feeling) {
    if (items.length === 0) {
      onComplete(0);
      return;
    }
    let lo, hi;
    if (feeling === 'good') {
      lo = 0;
      hi = Math.floor(items.length / 2);
    } else {
      lo = Math.floor(items.length / 2);
      hi = items.length;
    }
    if (lo >= hi) {
      onComplete(lo);
      return;
    }
    setLow(lo);
    setHigh(hi);
    setMid(Math.floor((lo + hi) / 2));
    setPhase('comparing');
  }

  function handleCompare(isBetter) {
    let newLow = low, newHigh = high;
    if (isBetter) {
      newHigh = mid;
    } else {
      newLow = mid + 1;
    }
    if (newLow >= newHigh) {
      onComplete(newLow);
      return;
    }
    setLow(newLow);
    setHigh(newHigh);
    setMid(Math.floor((newLow + newHigh) / 2));
  }

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const modalStyle = {
    background: '#fff', borderRadius: '16px', padding: '32px',
    maxWidth: 440, width: '90%', textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
  };
  const btnStyle = (color) => ({
    background: color, color: '#fff', border: 'none', borderRadius: '8px',
    padding: '12px 28px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
  });

  if (phase === 'feeling') {
    return (
      <div style={overlayStyle} onClick={onCancel}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>How do you feel about this?</h3>
          <p style={{ color: '#666', marginBottom: '24px', fontSize: '0.9rem' }}>
            This helps us narrow down where it belongs.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button onClick={() => handleFeeling('good')} style={btnStyle('#16a34a')}>
              Good
            </button>
            <button onClick={() => handleFeeling('bad')} style={btnStyle('#dc2626')}>
              Bad
            </button>
          </div>
          <button onClick={onCancel} style={{
            marginTop: '20px', background: 'none', border: 'none',
            color: '#888', cursor: 'pointer', fontSize: '0.85rem',
          }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === 'comparing') {
    const compareItem = items[mid];
    return (
      <div style={overlayStyle} onClick={onCancel}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>Where does it rank?</h3>
          <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
            Is your new item better or worse than:
          </p>
          <div style={{
            background: '#f3f4f6', borderRadius: '10px', padding: '16px',
            marginBottom: '24px', fontSize: '1.05rem', fontWeight: 600,
          }}>
            #{mid + 1} {compareItem.text}
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button onClick={() => handleCompare(true)} style={btnStyle('#4f46e5')}>
              Better
            </button>
            <button onClick={() => handleCompare(false)} style={btnStyle('#9333ea')}>
              Worse
            </button>
          </div>
          <button onClick={onCancel} style={{
            marginTop: '20px', background: 'none', border: 'none',
            color: '#888', cursor: 'pointer', fontSize: '0.85rem',
          }}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}

export default function MyRankings() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    api.getRankings(user)
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAdd(e) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setAddError('');
    setAdding(true);
    try {
      const item = await api.addItem(text);
      setItems(prev => [...prev, item]);
      setNewText('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleWizardComplete(position) {
    const text = newText.trim();
    if (!text) return;
    setWizardOpen(false);
    setAddError('');
    setAdding(true);
    try {
      const item = await api.addItem(text);
      const newItems = [...items];
      newItems.splice(position, 0, item);
      setItems(newItems);
      await api.reorder(newItems.map(i => i.id));
      setNewText('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  async function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    try {
      await api.reorder(reordered.map(i => i.id));
    } catch (err) {
      // Revert on failure
      setItems(items);
      setError('Failed to save order: ' + err.message);
    }
  }

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>My Rankings</h2>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '0.9rem' }}>
        Drag to reorder. Add anything you want to rank.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value.slice(0, 100))}
            placeholder="Add a new entry…"
            maxLength={100}
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {addError && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{addError}</span>}
            <span style={{ marginLeft: 'auto', color: newText.length > 90 ? '#f59e0b' : '#aaa', fontSize: '0.8rem' }}>
              {newText.length}/100
            </span>
          </div>
        </div>
        <button
          type="submit"
          disabled={adding || !newText.trim()}
          style={{
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0 20px',
            fontWeight: 600,
            fontSize: '0.95rem',
            alignSelf: 'flex-start',
            height: '44px',
            opacity: adding || !newText.trim() ? 0.6 : 1,
          }}
        >
          Add
        </button>
        <button
          type="button"
          disabled={adding || !newText.trim() || items.length === 0}
          onClick={() => setWizardOpen(true)}
          style={{
            background: '#9333ea',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0 16px',
            fontWeight: 600,
            fontSize: '0.85rem',
            alignSelf: 'flex-start',
            height: '44px',
            opacity: adding || !newText.trim() || items.length === 0 ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          Help me add
        </button>
      </form>

      {wizardOpen && (
        <HelpMeAddWizard
          items={items}
          onComplete={handleWizardComplete}
          onCancel={() => setWizardOpen(false)}
        />
      )}

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '0.9rem',
        }}>{error}</div>
      )}

      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '40px',
          textAlign: 'center', color: '#888', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}>
          Your list is empty. Add something above to get started!
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              item={{ ...item, rank: index }}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeItem && (
            <RankingCard
              item={activeItem}
              onDelete={() => {}}
              rank={items.findIndex(i => i.id === activeId)}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
