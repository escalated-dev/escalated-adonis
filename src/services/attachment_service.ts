import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import Attachment from '../models/attachment.js'

export default class AttachmentService {
  /**
   * Store a single uploaded file as an attachment.
   */
  async store(
    attachableType: string,
    attachableId: number,
    file: any // MultipartFile from AdonisJS
  ): Promise<Attachment> {
    const config = (globalThis as any).__escalated_config
    const disk = config?.storage?.disk ?? 'public'
    const basePath = config?.storage?.path ?? 'escalated/attachments'

    const ext = file.extname || extname(file.clientName || '')
    const filename = `${randomUUID()}${ext}`

    // Move the file using Adonis Drive
    await file.moveToDisk(basePath, { name: filename }, disk)

    const attachment = await Attachment.create({
      attachableType,
      attachableId,
      filename,
      originalFilename: file.clientName || filename,
      mimeType: file.headers?.['content-type'] || file.type
        ? `${file.type}/${file.subtype}`
        : 'application/octet-stream',
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
