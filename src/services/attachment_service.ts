import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import Attachment from '../models/attachment.js'
import { getConfig } from '../helpers/config.js'

/**
 * The Drive disk new attachments are written to: `storage.disk`, or the
 * application's default disk. It must be private (not served by
 * `serveFiles`, a public bucket or a CDN); the download route is the only way
 * attachments are read. See docs/private-attachments.md.
 */
export async function attachmentDisk(): Promise<string> {
  const configured = (getConfig() as any).storage?.disk
  if (typeof configured === 'string' && configured !== '') return configured
  // config/drive.ts holds a config provider; resolve it the way Drive does.
  const { default: app } = await import('@adonisjs/core/services/app')
  const { configProvider } = await import('@adonisjs/core')
  const driveConfig = app.config.get<any>('drive')
  const resolved: any = driveConfig ? await configProvider.resolve(app, driveConfig) : null
  const name = resolved?.config?.default ?? resolved?.default ?? driveConfig?.default
  if (typeof name !== 'string' || name === '') {
    throw new Error('Escalated: set `storage.disk` or configure a default Drive disk.')
  }
  return name
}

/** The directory inside the disk new attachments are written to. */
export function attachmentBasePath(): string {
  return (getConfig() as any).storage?.path ?? 'escalated/attachments'
}

export default class AttachmentService {
  /**
   * Store a single uploaded file as an attachment.
   */
  async store(
    attachableType: string,
    attachableId: number,
    file: any // MultipartFile from AdonisJS
  ): Promise<Attachment> {
    const disk = await attachmentDisk()
    const basePath = attachmentBasePath()

    const rawExt = String(file.extname || extname(file.clientName || '')).replace(
      /[^A-Za-z0-9]/g,
      ''
    )
    const ext = rawExt ? `.${rawExt}` : ''
    const filename = `${randomUUID()}${ext}`

    // Drive 4: moveToDisk(key, disk, options). Written private; only the
    // download route reads it back.
    await file.moveToDisk(`${basePath}/${filename}`, disk, { visibility: 'private' })

    const attachment = await Attachment.create({
      attachableType,
      attachableId,
      filename,
      originalFilename: file.clientName || filename,
      mimeType:
        file.type && file.subtype
          ? `${file.type}/${file.subtype}`
          : file.headers?.['content-type'] || 'application/octet-stream',
      size: file.size || 0,
      disk,
      path: `${basePath}/${filename}`,
    })

    return attachment
  }

  /**
   * Store multiple uploaded files as attachments.
   */
  async storeMany(
    attachableType: string,
    attachableId: number,
    files: any[]
  ): Promise<Attachment[]> {
    const attachments: Attachment[] = []

    for (const file of files) {
      if (file) {
        const attachment = await this.store(attachableType, attachableId, file)
        attachments.push(attachment)
      }
    }

    return attachments
  }

  /**
   * Delete an attachment and its file from storage.
   */
  async delete(attachment: Attachment): Promise<void> {
    try {
      const { default: drive } = await import('@adonisjs/drive/services/main')
      await drive.use(attachment.disk as any).delete(attachment.path)
    } catch {
      // File may already be deleted
    }

    await attachment.delete()
  }
}
