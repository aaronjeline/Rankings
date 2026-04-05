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

export default function MyRankings() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [activeId, setActiveId] = useState(null);

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
      </form>

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
