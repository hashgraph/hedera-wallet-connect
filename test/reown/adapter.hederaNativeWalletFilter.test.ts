import { HederaAdapter, hederaNamespace } from '../../src'

const EVENT = 'eip6963:announceProvider'

describe('HederaAdapter filters HashPack EIP-6963 announcement', () => {
  const originalWindow = (globalThis as any).window
  let target: EventTarget

  const announce = (rdns: string | undefined) =>
    target.dispatchEvent(
      new CustomEvent(EVENT, {
        detail: rdns === undefined ? {} : { info: { rdns } },
      }),
    )

  beforeEach(() => {
    target = new EventTarget()
    ;(globalThis as any).window = target
  })

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as any).window
    } else {
      ;(globalThis as any).window = originalWindow
    }
  })

  it('filters HashPack when namespace is hedera and passes others through', () => {
    new HederaAdapter({ namespace: hederaNamespace })

    const downstream = jest.fn()
    target.addEventListener(EVENT, downstream)

    announce('app.hashpack')
    announce('io.metamask')

    expect(downstream).toHaveBeenCalledTimes(1)
    expect(
      (downstream.mock.calls[0][0] as CustomEvent).detail.info.rdns,
    ).toBe('io.metamask')
  })

  it('does not install the filter when namespace is eip155', () => {
    new HederaAdapter({ namespace: 'eip155' })

    const downstream = jest.fn()
    target.addEventListener(EVENT, downstream)

    announce('app.hashpack')

    expect(downstream).toHaveBeenCalledTimes(1)
  })

  it('is idempotent across multiple adapter instances', () => {
    new HederaAdapter({ namespace: hederaNamespace })
    new HederaAdapter({ namespace: hederaNamespace })

    const downstream = jest.fn()
    target.addEventListener(EVENT, downstream)

    announce('app.hashpack')

    expect(downstream).not.toHaveBeenCalled()
  })

  it('is a no-op when window is unavailable', () => {
    delete (globalThis as any).window
    expect(() => new HederaAdapter({ namespace: hederaNamespace })).not.toThrow()
  })
})
