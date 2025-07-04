import Provider from '../../src/lib/wallet/provider'
import {
  AccountBalanceQuery,
  AccountInfoQuery,
  AccountRecordsQuery,
  TransactionReceiptQuery,
  TransactionId,
} from '@hashgraph/sdk'
import { testNodeAccountId, testTransactionId } from '../_helpers'

describe('Provider', () => {
  const client = {
    ledgerId: 'test-ledger',
    network: { network: 'testnet' },
    mirrorNetwork: ['mirror.testnet'],
  } as any
  let provider: Provider

  beforeEach(() => {
    provider = new Provider(client)
  })

  it('fromClient returns instance', () => {
    expect(Provider.fromClient(client)).toBeInstanceOf(Provider)
  })

  it('returns ledger and network info', () => {
    expect(provider.getLedgerId()).toBe(client.ledgerId)
    expect(provider.getNetwork()).toBe(client.network)
    expect(provider.getMirrorNetwork()).toBe(client.mirrorNetwork)
  })

  it('gets account balance', async () => {
    const execute = jest
      .spyOn(AccountBalanceQuery.prototype, 'execute')
      .mockResolvedValue('balance' as any)
    const result = await provider.getAccountBalance('0.0.1')
    expect(execute).toHaveBeenCalledWith(client)
    expect(result).toBe('balance')
    execute.mockRestore()
  })

  it('gets account info', async () => {
    const execute = jest
      .spyOn(AccountInfoQuery.prototype, 'execute')
      .mockResolvedValue('info' as any)
    const result = await provider.getAccountInfo('0.0.1')
    expect(execute).toHaveBeenCalledWith(client)
    expect(result).toBe('info')
    execute.mockRestore()
  })

  it('gets account records', async () => {
    const execute = jest
      .spyOn(AccountRecordsQuery.prototype, 'execute')
      .mockResolvedValue('records' as any)
    const result = await provider.getAccountRecords('0.0.1')
    expect(execute).toHaveBeenCalledWith(client)
    expect(result).toBe('records')
    execute.mockRestore()
  })

  it('gets transaction receipt', async () => {
    const execute = jest
      .spyOn(TransactionReceiptQuery.prototype, 'execute')
      .mockResolvedValue('receipt' as any)
    const result = await provider.getTransactionReceipt(testTransactionId)
    expect(execute).toHaveBeenCalledWith(client)
    expect(result).toBe('receipt')
    execute.mockRestore()
  })

  it('waits for receipt', async () => {
    const execute = jest
      .spyOn(TransactionReceiptQuery.prototype, 'execute')
      .mockResolvedValue('receipt' as any)
    const response = { nodeId: testNodeAccountId, transactionId: testTransactionId } as any
    const result = await provider.waitForReceipt(response)
    expect(execute).toHaveBeenCalledWith(client)
    expect(result).toBe('receipt')
    execute.mockRestore()
  })

  it('calls executable with client', async () => {
    const request = { execute: jest.fn().mockResolvedValue('out') } as any
    const result = await provider.call(request)
    expect(request.execute).toHaveBeenCalledWith(client)
    expect(result).toBe('out')
  })
})
