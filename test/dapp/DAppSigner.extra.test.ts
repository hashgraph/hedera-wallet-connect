import {
  DAppSigner,
  HederaJsonRpcMethod,
  Uint8ArrayToBase64String,
} from '../../src'
import {
  AccountId,
  LedgerId,
  PrivateKey,
  TransactionReceiptQuery,
  Client,
  TransactionId,
  TransactionReceipt,
  AccountCreateTransaction,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import { ISignClient } from '@walletconnect/types'
import { prepareTestTransaction, dAppMetadata } from '../_helpers'
const utils = require('../../src/lib/shared/utils')
jest.mock('../../src/lib/shared/utils', () => {
  const actual = jest.requireActual('../../src/lib/shared/utils')
  return {
    ...actual,
    transactionToTransactionBody: jest.fn(actual.transactionToTransactionBody),
  }
})

jest.mock('../../src/lib/shared/extensionController', () => ({
  extensionOpen: jest.fn(),
}))

jest.mock('../../src/lib/shared/mirrorNode', () => ({
  getAccountInfo: jest.fn(),
}))

const { extensionOpen } = require('../../src/lib/shared/extensionController')

describe('DAppSigner additional branch coverage', () => {
  const testAccountId = AccountId.fromString('0.0.123')
  const testTopic = 'test-topic'
  let mockSignClient: jest.Mocked<ISignClient>

  beforeEach(() => {
    mockSignClient = {
      request: jest.fn(),
      metadata: dAppMetadata,
      session: { get: jest.fn(() => ({ topic: testTopic })) },
      emit: jest.fn(),
    } as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses default mainnet ledger and mainnet client', async () => {
    const mainnetClient = {} as Client
    const mainnetSpy = jest
      .spyOn(Client, 'forMainnet')
      .mockReturnValue(mainnetClient)

    const receipt = TransactionReceipt.fromBytes(
      proto.TransactionGetReceiptResponse.encode({
        receipt: { status: proto.ResponseCodeEnum.SUCCESS },
      }).finish(),
    )

    jest
      .spyOn(TransactionReceiptQuery.prototype, 'execute')
      .mockResolvedValue(receipt)

    const signerMainnet = new DAppSigner(testAccountId, mockSignClient, testTopic)
    const result = await (signerMainnet as any).executeReceiptQueryFromRequest(
      new TransactionReceiptQuery().setTransactionId(
        TransactionId.generate(testAccountId),
      ),
    )

    expect(mainnetSpy).toHaveBeenCalled()
    expect(result.result).toBeInstanceOf(TransactionReceipt)
    expect(signerMainnet.getLedgerId().toString()).toBe('mainnet')
  })

  it('request does not invoke extensionOpen when no extensionId', async () => {
    const signerNoExt = new DAppSigner(
      testAccountId,
      mockSignClient,
      testTopic,
      LedgerId.TESTNET,
    )
    mockSignClient.request.mockResolvedValueOnce('ok')

    const result = await signerNoExt.request({ method: 'test', params: {} })
    expect(result).toBe('ok')
    expect(extensionOpen).not.toHaveBeenCalled()
  })

  it('setLogLevel noop when logger is not DefaultLogger', () => {
    const signerInstance = new DAppSigner(testAccountId, mockSignClient, testTopic)
    const fakeLogger = { setLogLevel: jest.fn() }
    ;(signerInstance as any).logger = fakeLogger
    signerInstance.setLogLevel('error')
    expect(fakeLogger.setLogLevel).not.toHaveBeenCalled()
  })

  it('sign with base64 encoding uses ECDSA signature branch', async () => {
    const signerInstance = new DAppSigner(
      testAccountId,
      mockSignClient,
      testTopic,
      LedgerId.TESTNET,
    )
    const key = PrivateKey.generate()
    const sigBytes = new Uint8Array([9, 8, 7])
    jest.spyOn(signerInstance, 'request').mockResolvedValueOnce({
      signatureMap: Uint8ArrayToBase64String(
        proto.SignatureMap.encode({
          sigPair: [
            {
              pubKeyPrefix: key.publicKey.toBytes(),
              ECDSASecp256k1: sigBytes,
            },
          ],
        }).finish(),
      ),
    })

    const data = new Uint8Array([1, 2, 3])
    const [sig] = await signerInstance.sign([data], { encoding: 'base64' })
    expect(Array.from(sig.signature)).toEqual(Array.from(sigBytes))
  })

  it('signTransaction throws when transaction body cannot be serialized', async () => {
    const signerInstance = new DAppSigner(
      testAccountId,
      mockSignClient,
      testTopic,
      LedgerId.TESTNET,
    )

    const tx = prepareTestTransaction(new AccountCreateTransaction(), { freeze: true })

    jest
      .spyOn(utils, 'transactionToTransactionBody')
      .mockReturnValueOnce(null as any)

    await expect(signerInstance.signTransaction(tx)).rejects.toThrow(
      'Failed to serialize transaction body',
    )
  })
})
