import { PrivateKey, TopicCreateTransaction, TransferTransaction, AccountInfoQuery } from '@hashgraph/sdk'
import {
  HIP820Wallet,
  HederaChainId,
  HederaJsonRpcMethod,
  transactionToBase64String,
  queryToBase64String,
  transactionBodyToBase64String,
  transactionToTransactionBody,
} from '../../../../src'
import {
  testPrivateKeyECDSA,
  testUserAccountId,
  defaultAccountNumber,
  prepareTestTransaction,
  prepareTestQuery,
} from '../../../_helpers'
import { getSdkError } from '@walletconnect/utils'

describe('HIP820Wallet parseSessionRequest extra', () => {
  const chainId = HederaChainId.Testnet
  const accountId = testUserAccountId.toString()
  const privateKey = PrivateKey.fromStringECDSA(testPrivateKeyECDSA)
  let wallet: HIP820Wallet

  beforeEach(() => {
    wallet = HIP820Wallet.init({ chainId, accountId, privateKey })
  })

  function buildEvent(method: HederaJsonRpcMethod | string, params: any) {
    return {
      id: 1,
      topic: 'topic',
      params: { request: { method, params }, chainId },
    } as any
  }

  it('parses ExecuteTransaction request', () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const txStr = transactionToBase64String(tx)
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: txStr }),
    )
    expect(res.body?.toBytes()).toEqual(tx.toBytes())
  })

  it('parses SignAndExecuteQuery request', () => {
    const query = prepareTestQuery(new AccountInfoQuery())
    const qStr = queryToBase64String(query)
    const acct = `${chainId}:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignAndExecuteQuery, { signerAccountId: acct, query: qStr }),
    )
    expect(res.accountId?.toString()).toBe(`0.0.${defaultAccountNumber}`)
    expect(res.body?.toBytes()).toEqual(query.toBytes())
  })

  it('parses SignAndExecuteTransaction request', () => {
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    const txStr = transactionToBase64String(tx)
    const acct = `${chainId}:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignAndExecuteTransaction, { signerAccountId: acct, transactionList: txStr }),
    )
    expect(res.accountId?.toString()).toBe(`0.0.${defaultAccountNumber}`)
    expect(res.body?.toBytes()).toEqual(tx.toBytes())
  })

  it('parses SignTransaction request', () => {
    const tx = prepareTestTransaction(new TransferTransaction(), { freeze: true })
    const body = transactionToTransactionBody(tx)
    const bodyStr = transactionBodyToBase64String(body)
    const acct = `${chainId}:0.0.${defaultAccountNumber}`
    const res = wallet.parseSessionRequest(
      buildEvent(HederaJsonRpcMethod.SignTransaction, { signerAccountId: acct, transactionBody: bodyStr }),
    )
    expect(res.accountId?.toString()).toBe(`0.0.${defaultAccountNumber}`)
    expect((res.body as Buffer).equals(Buffer.from(bodyStr, 'base64'))).toBe(true)
  })

  it('throws on invalid method', () => {
    const ev = buildEvent('badmethod' as HederaJsonRpcMethod, {})
    expect(() => wallet.parseSessionRequest(ev)).toThrow(getSdkError('INVALID_METHOD'))
  })

  it('returns partial result when shouldThrow is false', () => {
    const badEv = buildEvent(HederaJsonRpcMethod.ExecuteTransaction, { transactionList: 123 })
    const res = wallet.parseSessionRequest(badEv as any, false)
    expect(res.method).toBe(HederaJsonRpcMethod.ExecuteTransaction)
    expect(res.body).toBeUndefined()
  })
})
