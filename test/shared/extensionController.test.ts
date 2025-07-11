import {
  EVENTS,
  extensionQuery,
  extensionConnect,
  extensionOpen,
  findExtensions,
} from '../../src/lib/shared/extensionController'

describe('extensionController helpers', () => {
  const originalWindow = global.window as any
  let postMessage: jest.Mock
  let parentPostMessage: jest.Mock

  beforeEach(() => {
    postMessage = jest.fn()
    parentPostMessage = jest.fn()
    ;(global as any).window = {
      addEventListener: jest.fn(),
      postMessage,
      parent: { postMessage: parentPostMessage },
    }
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as any).window = originalWindow
    jest.resetAllMocks()
  })

  it('extensionQuery posts messages to window and parent', () => {
    extensionQuery()
    expect(postMessage).toHaveBeenCalledWith({ type: EVENTS.extensionQuery }, '*')
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: EVENTS.iframeQuery },
      '*',
    )
  })

  it('extensionQuery skips parent when not available', () => {
    ;(global as any).window = { postMessage }

    expect(() => extensionQuery()).not.toThrow()
    expect(postMessage).toHaveBeenCalledWith({ type: EVENTS.extensionQuery }, '*')
  })

  it('extensionConnect posts to parent when iframe', () => {
    extensionConnect('id', true, 'pair')
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: EVENTS.iframeConnect, pairingString: 'pair' },
      '*',
    )
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('extensionConnect posts to window when not iframe', () => {
    extensionConnect('id', false, 'pair')
    expect(postMessage).toHaveBeenCalledWith(
      { type: EVENTS.extensionConnect + 'id', pairingString: 'pair' },
      '*',
    )
  })

  it('extensionOpen posts message', () => {
    extensionOpen('open')
    expect(postMessage).toHaveBeenCalledWith(
      { type: EVENTS.extensionOpen + 'open' },
      '*',
    )
  })

  it('findExtensions triggers query and handles events', () => {
    let messageHandler: any
    ;(window as any).addEventListener = jest.fn((evt, handler) => {
      if (evt === 'message') messageHandler = handler
    })

    const cb = jest.fn()
    findExtensions(cb)

    jest.advanceTimersByTime(200)
    expect(postMessage).toHaveBeenCalledWith({ type: EVENTS.extensionQuery }, '*')
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: EVENTS.iframeQuery },
      '*',
    )

    const metadata = { id: 'ext', available: true, availableInIframe: false }
    messageHandler({ data: { type: EVENTS.extensionResponse, metadata } })
    expect(cb).toHaveBeenCalledWith(metadata, false)

    const metadata2 = { id: 'ext2', available: true, availableInIframe: true }
    messageHandler({ data: { type: EVENTS.iframeQueryResponse, metadata: metadata2 } })
    expect(cb).toHaveBeenCalledWith(metadata2, true)
  })

  it('findExtensions does nothing when window is undefined', () => {
    ;(global as any).window = undefined
    const cb = jest.fn()

    expect(() => findExtensions(cb)).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })
})
