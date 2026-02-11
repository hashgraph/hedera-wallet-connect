import { AccountInfoQuery, TopicCreateTransaction, PrecheckStatusError, Status, PrivateKey } from '@hiero-ledger/sdk'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import {
  HIP820Wallet,
  HederaChainId,
} from '../../../../src'
import {
  requestId,
  testPrivateKeyECDSA,
  testUserAccountId,
  prepareTestTransaction,
  prepareTestQuery,
  testNodeAccountId,
  testTransactionId,
} from '../../../_helpers'

const chainId = HederaChainId.Testnet
const accountId = testUserAccountId.toString()
const privateKey = testPrivateKeyECDSA

describe('HIP820Wallet method extras', () => {
  let wallet: HIP820Wallet

  beforeEach(() => {
    wallet = HIP820Wallet.init({
      chainId,
      accountId,
      privateKey: PrivateKey.fromStringECDSA(privateKey),
    })
  })

  it('hedera_signAndExecuteQuery handles array response', async () => {
    const query = prepareTestQuery(new AccountInfoQuery())
    const arr = [
      { toBytes: () => Buffer.from('a') },
      { toBytes: () => Buffer.from('b') },
    ]
    jest.spyOn(query, 'executeWithSigner').mockResolvedValue(arr as any)

    const res = await wallet.hedera_signAndExecuteQuery(requestId, query)
    expect(res).toEqual(
      formatJsonRpcResult(requestId, {
        response: arr.map((v) => v.toBytes().toString('base64')).join(','),
      }),
    )
  })

  it('hedera_signAndExecuteQuery handles PrecheckStatusError', async () => {
    const query = prepareTestQuery(new AccountInfoQuery())
    const error = new PrecheckStatusError({
      status: Status.InvalidTransaction,
      transactionId: testTransactionId,
      nodeId: testNodeAccountId,
      contractFunctionResult: null,
    })
    error.message = 'bad query'
    jest.spyOn(query, 'executeWithSigner').mockRejectedValue(error)
    const res = await wallet.hedera_signAndExecuteQuery(requestId, query)
    expect(res).toEqual(
      formatJsonRpcError(requestId, {
        code: 9000,
        message: error.message,
        data: error.status._code.toString(),
      }),
    )
  })

  it('hedera_signAndExecuteQuery handles unknown error', async () => {
    const query = prepareTestQuery(new AccountInfoQuery())
    jest.spyOn(query, 'executeWithSigner').mockRejectedValue(new Error('oops'))
    const res = await wallet.hedera_signAndExecuteQuery(requestId, query)
    expect(res).toEqual(
      formatJsonRpcError(requestId, { code: 9000, message: 'Unknown Error' }),
    )
  })

  it('hedera_signAndExecuteTransaction handles PrecheckStatusError', async () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const error = new PrecheckStatusError({
      status: Status.InvalidTransaction,
      transactionId: tx.transactionId,
      nodeId: testNodeAccountId,
      contractFunctionResult: null,
    })
    error.message = 'tx bad'
    jest.spyOn(tx, 'signWithSigner').mockResolvedValue(tx as any)
    jest.spyOn(tx, 'executeWithSigner').mockRejectedValue(error)
    const res = await wallet.hedera_signAndExecuteTransaction(requestId, tx)
    expect(res).toEqual(
      formatJsonRpcError(requestId, {
        code: 9000,
        message: error.message,
        data: error.status._code.toString(),
      }),
    )
  })

  it('hedera_signAndExecuteTransaction handles unknown error', async () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    jest.spyOn(tx, 'signWithSigner').mockResolvedValue(tx as any)
    jest.spyOn(tx, 'executeWithSigner').mockRejectedValue(new Error('oops'))
    const res = await wallet.hedera_signAndExecuteTransaction(requestId, tx)
    expect(res).toEqual(formatJsonRpcError(requestId, { code: 9000, message: 'Unknown Error' }))
  })
})
