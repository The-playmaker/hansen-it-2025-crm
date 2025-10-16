'use client';
export default function DetailModal({ open, onClose, item, onSave }) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Sak: {item.name}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">Lukk</button>
        </div>
        <div className="grid gap-4">
          <div>
            <div className="text-sm text-white/60">E-post</div>
            <div>{item.email}</div>
          </div>
          <div>
            <div className="text-sm text-white/60">Firma</div>
            <div>{item.company || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-white/60">Melding</div>
            <pre className="whitespace-pre-wrap">{item.message}</pre>
          </div>
          <div>
            <div className="text-sm text-white/60 mb-1">Interne notater</div>
            <textarea
              className="input h-28"
              defaultValue={item.internal_notes || ''}
              onBlur={(e) => onSave({ internal_notes: e.target.value })}
            />
            <p className="text-xs text-white/50 mt-1">Lagre ved å klikke utenfor feltet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
