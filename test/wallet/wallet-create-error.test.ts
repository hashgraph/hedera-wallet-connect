import { projectId, walletMetadata } from '../_helpers'

jest.mock('@walletconnect/core', () => ({
  Core: jest.fn().mockImplementation((opts: any) => ({ projectId: opts.projectId })),
}))

const engineInit = jest.fn().mockRejectedValue(new Error('boom'))

jest.mock('@reown/walletkit', () => ({
  WalletKit: class {
    core: any
    engine = { init: engineInit }
    logger = { trace: jest.fn(), info: jest.fn(), error: jest.fn() }
    metadata: any
    constructor(opts: any) {
      this.core = opts.core
      this.metadata = opts.metadata
    }
  },
  WalletKitTypes: { Options: {} } as any,
}))

import Wallet from '../../src/lib/wallet'

describe('HederaWeb3Wallet.create failure', () => {
  it('throws and logs when engine init fails', async () => {
    await expect(Wallet.create(projectId, walletMetadata)).rejects.toThrow('boom')
    expect(engineInit).toHaveBeenCalled()
  })
})
