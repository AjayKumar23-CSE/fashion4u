import { useRef, useState } from 'react'
import { ACCEPT, imageSrc, uploadImage } from '../lib/images'
import type { UploadFolder } from '../lib/images'

interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  folder: UploadFolder
  // A single image (category tile, size chart) or an ordered gallery.
  multiple?: boolean
}

// Uploads go straight to S3; this component only keeps the resulting URLs.
// In a gallery, drag thumbnails to reorder: the first one is the listing image.
export function ImageUploader({ value, onChange, folder, multiple = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(files.length)

    const results = await Promise.allSettled(Array.from(files).map((file) => uploadImage(file, folder)))
    const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failed = results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as Error).message] : []))

    if (uploaded.length > 0) onChange(multiple ? [...value, ...uploaded] : [uploaded[0]])
    if (failed.length > 0) setError(failed.join(' · '))
    setUploading(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  function moveTo(target: number) {
    if (dragIndex === null || dragIndex === target) return
    const next = [...value]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    onChange(next)
    setDragIndex(null)
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <li
            key={url}
            draggable={multiple}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => moveTo(index)}
            className={`relative h-32 w-24 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 ${
              multiple ? 'cursor-grab' : ''
            } ${dragIndex === index ? 'opacity-40' : ''}`}
          >
            <img src={imageSrc(url)} alt="" className="h-full w-full object-cover" draggable={false} />
            {multiple && index === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-neutral-900/80 py-0.5 text-center text-[10px] font-semibold text-white">
                Listing image
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label="Remove image"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold shadow hover:bg-red-50 hover:text-red-700"
            >
              ×
            </button>
          </li>
        ))}

        {(multiple || value.length === 0) && (
          <li>
            <button
              type="button"
              disabled={uploading > 0}
              onClick={() => inputRef.current?.click()}
              className="flex h-32 w-24 flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 text-xs text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
            >
              <span className="text-2xl leading-none">+</span>
              {uploading > 0 ? `Uploading ${uploading}…` : multiple ? 'Add images' : 'Upload'}
            </button>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-neutral-500">
        JPG, PNG or WebP, up to 5 MB each.{multiple && ' Drag to reorder.'}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
