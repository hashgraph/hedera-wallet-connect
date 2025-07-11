import { EIP155Wallet } from '../../../../src/reown/wallets/EIP155Wallet'
import { formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import { PrivateKey } from '@hashgraph/sdk'
import { testPrivateKeyECDSA, requestId, requestTopic } from '../../../_helpers'
import {
  HederaChainDefinition,
  Eip155JsonRpcMethod,
  WalletRequestEventArgs,
} from '../../../../src/reown/utils'

describe('EIP155Wallet transaction hash branch', () => {
  let wallet: EIP155Wallet
  const privateKey = `0x${PrivateKey.fromStringECDSA(testPrivateKeyECDSA).toStringRaw()}`
  const chainId = HederaChainDefinition.EVM.Testnet.caipNetworkId
  const txHash = '0xabcdef'

  const createEvent = (method: Eip155JsonRpcMethod, params: any[]): WalletRequestEventArgs => ({
    id: requestId,
    topic: requestTopic,
    params: {
      request: { method, params },
      chainId,
    },
  })

  beforeEach(() => {
    wallet = EIP155Wallet.init({ privateKey })
  })

  it('handles SendTransaction returning string', async () => {
    const event = createEvent(Eip155JsonRpcMethod.SendTransaction, [{ to: '0x1', value: '0x1' }])
    jest.spyOn(wallet, 'eth_sendTransaction').mockResolvedValue(txHash as any)

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcResult(requestId, txHash))
  })

  it('handles SendRawTransaction returning string', async () => {
    const event = createEvent(Eip155JsonRpcMethod.SendRawTransaction, ['0xraw'])
    jest.spyOn(wallet, 'eth_sendRawTransaction').mockResolvedValue(txHash as any)

    const result = await wallet.approveSessionRequest(event)
    expect(result).toEqual(formatJsonRpcResult(requestId, txHash))
  })
})
