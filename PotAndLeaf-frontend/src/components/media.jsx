import { useRef, useState } from 'react';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { Spinner } from './ui';

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data.url;
}

/** Single image picker — avatar/logo. `value` is a URL string (or null). */
export function ImageUpload({ value, onChange, shape = 'circle', hint = 'PNG or JPG, up to 5MB' }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadFile(file)); }
    catch { toast.error('Upload failed. Try a smaller image.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  return (
    <div className="flex items-center gap-4">
      <div className={'relative flex size-20 shrink-0 items-center justify-center overflow-hidden bg-leaf-soft ' + rounded}>
        {busy ? <Spinner className="size-5" />
          : value ? <img src={value} alt="" className="size-full object-cover" />
          : <PhotoIcon className="size-8 text-leaf/60" />}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-sidebar">
            <ArrowUpTrayIcon className="size-4" /> {value ? 'Replace' : 'Upload'}
          </button>
          {value && <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger"><XMarkIcon className="size-4" /></button>}
        </div>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}

/** Multi-image gallery — `value` is an array of URL strings. */
export function ImageGallery({ value = [], onChange, max = 6 }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const list = value ?? [];

  async function pick(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const room = Math.max(0, max - list.length);
      const urls = [];
      for (const f of files.slice(0, room)) urls.push(await uploadFile(f));
      onChange([...list, ...urls]);
      if (files.length > room) toast.info(`Only ${max} images allowed.`);
    } catch { toast.error('One or more uploads failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  const removeAt = (i) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {list.map((url, i) => (
          <div key={i} className="group relative size-24 overflow-hidden rounded-2xl border border-line">
            <img src={url} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100"><XMarkIcon className="size-3.5" /></button>
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-leaf px-1.5 py-0.5 text-[9px] font-medium text-white">Primary</span>}
          </div>
        ))}
        {list.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="flex size-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong text-muted hover:bg-sidebar">
            {busy ? <Spinner className="size-5" /> : <><PlusIcon className="size-5" /><span className="text-[11px]">Add photo</span></>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      <p className="mt-2 text-xs text-muted">First image is the primary. Up to {max} photos.</p>
    </div>
  );
}
