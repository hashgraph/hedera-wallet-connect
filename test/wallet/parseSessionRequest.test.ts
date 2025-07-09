import { Core } from '@walletconnect/core'
import {
  Wallet,
  HederaChainId,
  HederaJsonRpcMethod,
  transactionToBase64String,
  transactionToTransactionBody,
  transactionBodyToBase64String,
  queryToBase64String,
} from '../../src'
import { AccountInfoQuery, TopicCreateTransaction, TransferTransaction } from '@hashgraph/sdk'
import {
  projectId,
  walletMetadata,
  defaultAccountNumber,
  testPrivateKeyECDSA,
  prepareTestTransaction,
  prepareTestQuery,
} from '../_helpers'
import { getSdkError } from '@walletconnect/utils'

const chainId = HederaChainId.Testnet

function createWallet() {
  return new Wallet({ core: new Core({ projectId }), metadata: walletMetadata })
}

function buildEvent(method: HederaJsonRpcMethod, params: any) {
  return {
    id: 1,
    topic: 'topic',
    params: {
      request: { method, params },
      chainId,
    },
  } as any
}

describe(Wallet.name + ' parseSessionRequest', () => {
  let wallet: Wallet

  beforeEach(() => {
    wallet = createWallet()
  })

  it('validates parameter types', () => {
    expect(() => wallet.validateParam('arr', [1], 'array')).not.toThrow()
    expect(() => wallet.validateParam('str', 'a', 'string')).not.toThrow()
    expect(() => wallet.validateParam('bad', 1, 'string')).toThrow(
      'Invalid paramameter value for bad, expected string but got number',
    )
    expect(() => wallet.validateParam('arr', 'oops', 'array')).toThrow(
      'Invalid paramameter value for arr, expected array but got string',
    )
  })

  it('parses GetNodeAddresses request', () => {
    const res = wallet.parseSessionRequest(buildEvent(HederaJsonRpcMethod.GetNodeAddresses, null))
    expect(res.method).toBe(HederaJsonRpcMethod.GetNodeAddresses)
    expect(res.body).toBeUndefined()
    expect(res.accountId).toBeUndefined()
  })

  it('parses ExecuteTransaction request', () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const base64 = transactionToBase64String(tx)
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: base64 }),
    )
    expect(res.body?.toBytes()).toEqual(tx.toBytes())
  })

  it('parses SignMessage request', () => {
    const account = `hedera:testnet:0.0.${defaultAccountNumber}`
    const message = 'hello'
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignMessage, { signerAccountId: account, message }),
    )
    expect(res.accountId?.toString()).toBe(`0.0.${defaultAccountNumber}`)
    expect(res.body).toBe(message)
  })

  it('parses SignAndExecuteQuery request', () => {
    const query = prepareTestQuery(new AccountInfoQuery())
    const queryStr = queryToBase64String(query)
    const account = `hedera:testnet:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignAndExecuteQuery, { signerAccountId: account, query: queryStr }),
    )
    expect(res.body?.toBytes()).toEqual(query.toBytes())
  })

  it('parses SignAndExecuteTransaction request', () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const txStr = transactionToBase64String(tx)
    const account = `hedera:testnet:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignAndExecuteTransaction, { signerAccountId: account, transactionList: txStr }),
    )
    expect(res.body?.toBytes()).toEqual(tx.toBytes())
  })

  it('parses SignTransaction request', () => {
    const tx = prepareTestTransaction(new TransferTransaction(), { freeze: true })
    const body = transactionToTransactionBody(tx)
    const bodyStr = transactionBodyToBase64String(body)
    const account = `hedera:testnet:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignTransaction, { signerAccountId: account, transactionBody: bodyStr }),
    )
    expect((res.body as Buffer).equals(Buffer.from(bodyStr, 'base64'))).toBe(true)
  })

  it('throws on invalid params when shouldThrow is true', () => {
    const badEvent = buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: 123 })
    expect(() => wallet.parseSessionRequest(badEvent)).toThrow()
  })

  it('throws on invalid method', () => {
    const event = buildEvent('wrong' as HederaJsonRpcMethod, {})
    expect(() => wallet.parseSessionRequest(event)).toThrow(getSdkError('INVALID_METHOD'))
  })

  it('returns partial result when shouldThrow is false', () => {
    const badEvent = buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: 123 })
    const res = wallet.parseSessionRequest(badEvent, false)
    expect(res.method).toBe(HederaJsonRpcMethod.ExecuteTransaction)
    expect(res.body).toBeUndefined()
  })

  it('executes session request', async () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const txStr = transactionToBase64String(tx)
    const event = buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: txStr })
    const hederaWallet = wallet.getHederaWallet(
      chainId,
      `0.0.${defaultAccountNumber}`,
      testPrivateKeyECDSA,
    )
    const spy = jest.spyOn(wallet, 'hedera_executeTransaction').mockResolvedValue()
    await wallet.executeSessionRequest(event, hederaWallet)
    expect(spy).toHaveBeenCalled()
  })

  it('rejects session request', async () => {
    const event = buildEvent(HederaJsonRpcMethod.GetNodeAddresses, null)
    const spy = jest.spyOn(wallet, 'respondSessionRequest').mockReturnValue(undefined)
    await wallet.rejectSessionRequest(event, getSdkError('USER_REJECTED'))
    expect(spy).toHaveBeenCalled()
  })
})
