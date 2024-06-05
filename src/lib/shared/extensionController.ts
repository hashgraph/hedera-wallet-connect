export enum EVENTS {
  extensionQuery = 'hedera-extension-query',
  extensionConnect = 'hedera-extension-connect-',
  extensionOpen = 'hedera-extension-open-',
  extensionResponse = 'hedera-extension-response',
}

export type ExtensionData = {
  id: string
  name?: string
  icon?: string
  url?: string
  available: boolean
}

export const findExtensions = (onFound: (_metadata: ExtensionData) => void): void => {
  if (typeof window === 'undefined') return

  window.addEventListener(
    'message',
    (event): void => {
      if (event?.data?.type == EVENTS.extensionResponse && event.data.metadata) {
        onFound(event.data.metadata)
      }
    },
    false,
  )

  setTimeout(() => {
    extensionQuery()
  }, 200)
}

export const extensionQuery = () => {
  window.postMessage({ type: EVENTS.extensionQuery }, '*')
}

export const extensionConnect = (id: string, pairingString: string) => {
  window.postMessage({ type: EVENTS.extensionConnect + id, pairingString }, '*')
}

export const extensionOpen = (id: string) => {
  window.postMessage({ type: EVENTS.extensionOpen + id }, '*')
}
