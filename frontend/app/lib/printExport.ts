type PrintHtmlDocumentOptions = {
  html: string
  documentTitle: string
  stylesheetTimeoutMs?: number
  cleanupDelayMs?: number
}

export function printHtmlDocument({
  html,
  documentTitle,
  stylesheetTimeoutMs = 3000,
  cleanupDelayMs = 1000,
}: PrintHtmlDocumentOptions): void {
  const iframe = document.createElement('iframe')
  iframe.hidden = true
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const iframeWindow = iframe.contentWindow
  const iframeDocument = iframe.contentDocument || iframeWindow?.document
  if (!iframeWindow || !iframeDocument) {
    iframe.remove()
    throw new Error('Could not prepare the print document.')
  }

  iframeDocument.open()
  iframeDocument.write(html)
  iframeDocument.close()

  let printed = false
  let cleanedUp = false
  let fallbackTimer: number | undefined
  const originalTitle = document.title

  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
    document.title = originalTitle
    iframe.remove()
  }

  const print = () => {
    if (printed) return
    printed = true
    if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)

    document.title = documentTitle
    iframeWindow.addEventListener('afterprint', cleanup, { once: true })
    iframeWindow.focus()
    iframeWindow.print()
    window.setTimeout(cleanup, cleanupDelayMs)
  }

  const stylesheet = iframeDocument.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')
  if (!stylesheet) {
    print()
    return
  }

  stylesheet.addEventListener('load', print, { once: true })
  stylesheet.addEventListener('error', print, { once: true })
  fallbackTimer = window.setTimeout(print, stylesheetTimeoutMs)
}
