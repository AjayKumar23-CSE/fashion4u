import { api } from './api'
import { STOREFRONT_URL } from './config'

export type UploadFolder = 'products' | 'categories' | 'content'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
export const ACCEPT = ACCEPTED_TYPES.join(',')

// Seed images are storefront-relative paths; uploads are absolute S3 URLs.
export const imageSrc = (url: string) => (url.startsWith('/') ? `${STOREFRONT_URL}${url}` : url)

interface Upload {
  uploadUrl: string
  publicUrl: string
}

// Asks the API for a presigned URL, then sends the file straight to S3.
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG or WebP image`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: larger than 5 MB`)

  const upload = await api<Upload>('/admin/uploads', {
    method: 'POST',
    body: { folder, contentType: file.type },
  })
  const res = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error(`${file.name}: the storage bucket rejected the upload (${res.status})`)
  return upload.publicUrl
}
