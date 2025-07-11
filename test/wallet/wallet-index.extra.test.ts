import Wallet from '../../src/lib/wallet'
import { proto } from '@hashgraph/proto'
import { projectId, walletMetadata } from '../_helpers'

let createdWallet: any
const engineInitMock = jest.fn()

jest.mock('@reown/walletkit', () => {
  class MockWalletKit {
    core: any
    metadata: any
    logger: any
    engine: any
    respondSessionRequest = jest.fn()
    constructor(opts: any) {
      this.core = opts.core
      this.metadata = opts.metadata
      this.logger = { trace: jest.fn(), info: jest.fn(), error: jest.fn() }
      this.engine = { init: engineInitMock }
      createdWallet = this
    }
  }
  return { __esModule: true, WalletKit: MockWalletKit, WalletKitTypes: {} }
})

describe('HederaWeb3Wallet additional coverage', () => {
  beforeEach(() => {
    engineInitMock.mockReset()
  })

  it('logs and rethrows when initialization fails', async () => {
    const err = new Error('init fail')
    engineInitMock.mockRejectedValueOnce(err)

    await expect(Wallet.create(projectId, walletMetadata)).rejects.toThrow('init fail')

    expect(createdWallet.logger.trace).toHaveBeenCalledWith('Initialized')
    expect(createdWallet.logger.info).toHaveBeenCalledWith('Web3Wallet Initialization Failure')
    expect(createdWallet.logger.error).toHaveBeenCalledWith(err.message)
  })

  it('handles signing a transaction body', async () => {
    engineInitMock.mockResolvedValueOnce(undefined)
    const wallet = await Wallet.create(projectId, walletMetadata)

    const hederaWallet = {
      sign: jest.fn().mockResolvedValue([
        { publicKey: { _toProtobufSignature: () => ({ ed25519: new Uint8Array() }) }, signature: new Uint8Array() },
      ] as any),
    } as any

    const respond = jest
      .spyOn(wallet, 'respondSessionRequest')
      .mockReturnValue(undefined)

    const body = new Uint8Array([1, 2, 3])
    await wallet.hedera_signTransaction(1, 'topic', body, hederaWallet)

    expect(hederaWallet.sign).toHaveBeenCalledWith([body])
    expect(respond).toHaveBeenCalledWith({
      topic: 'topic',
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: { signatureMap: expect.any(String) },
      },
    })
  })
})
