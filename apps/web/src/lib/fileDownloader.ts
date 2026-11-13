interface DownloadOptions {
  filename: string
  contentType: string
  content: string | Uint8Array
}

export function downloadFile(options: DownloadOptions): void {
  const { filename, contentType, content } = options

  let blob: Blob
  if (content instanceof Uint8Array) {
    blob = new Blob([content.slice()], { type: contentType })
  } else {
    blob = new Blob([content], { type: contentType })
  }

  const url: string = URL.createObjectURL(blob)
  const link: HTMLAnchorElement = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url: string = URL.createObjectURL(blob)
  const link: HTMLAnchorElement = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
