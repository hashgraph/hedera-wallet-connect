export enum EVENTS {
  extensionQuery = 'hedera-extension-query-',
  extensionConnect = 'hedera-extension-connect-',
  extensionOpen = 'hedera-extension-open-',
  extensionResponse = 'hedera-extension-response',
  iframeQuery = 'hedera-iframe-query',
  iframeQueryResponse = 'hedera-iframe-response',
  iframeConnect = 'hedera-iframe-connect',
}

export type ExtensionData = {
  id: string
  name?: string
  icon?: string
  url?: string
  available: boolean
  availableInIframe: boolean
}

export const findExtensions = (
  ids: string[],
  onFound: (_metadata: ExtensionData, isFrame: boolean) => void,
): void => {
  if (typeof window === 'undefined') return

  window.addEventListener(
    'message',
    (event): void => {
      if (event?.data?.type == EVENTS.extensionResponse && event.data.metadata) {
        onFound(event.data.metadata, false)
      }
      if (event?.data?.type == EVENTS.iframeQueryResponse && event.data.metadata) {
        onFound(event.data.metadata, true)
      }
    },
    false,
  )

  setTimeout(() => {
    ids.forEach((id) => {
      extensionQuery(id)
    })
  }, 200)
}

export const extensionQuery = (id: string) => {
  window.postMessage({ type: EVENTS.extensionQuery + id }, '*')
  if (window.parent) {
    window.parent.postMessage({ type: EVENTS.iframeQuery }, '*')
  }
}

export const extensionConnect = (id: string, isIframe: boolean, pairingString: string) => {
  if (isIframe) {
    window.parent.postMessage({ type: EVENTS.iframeConnect, pairingString }, '*')
    return
  }
  window.postMessage({ type: EVENTS.extensionConnect + id, pairingString }, '*')
}

export const extensionOpen = (id: string) => {
  window.postMessage({ type: EVENTS.extensionOpen + id }, '*')
}
