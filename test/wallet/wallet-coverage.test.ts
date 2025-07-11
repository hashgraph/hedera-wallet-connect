import { Core } from '@walletconnect/core'
import Wallet, { WalletProvider } from "../../src/lib/wallet"
import { HederaChainId, HederaJsonRpcMethod, getHederaError } from "../../src"
import Provider from '../../src/lib/wallet/provider'
import {
  projectId,
  walletMetadata,
  testPrivateKeyECDSA,
  testUserAccountId,
  requestId,
  requestTopic,
} from '../_helpers'

describe('wallet additional coverage', () => {
  it('exports WalletProvider', () => {
    expect(WalletProvider).toBe(Provider)
  })


  it('parseSessionRequest throws for invalid GetNodeAddresses params', () => {
    const wallet = new Wallet({ core: new Core({ projectId }), metadata: walletMetadata })
    const event = {
      id: 1,
      topic: 't',
      params: {
        request: { method: HederaJsonRpcMethod.GetNodeAddresses, params: { foo: 'bar' } },
        chainId: HederaChainId.Testnet,
      },
    } as any
    expect(() => wallet.parseSessionRequest(event)).toThrow(getHederaError('INVALID_PARAMS'))
  })

  it('handles array query results', async () => {
    const wallet = await Wallet.create(projectId, walletMetadata)
    const hederaWallet = wallet.getHederaWallet(
      HederaChainId.Testnet,
      testUserAccountId.toString(),
      testPrivateKeyECDSA,
    )
    const query = {
      executeWithSigner: jest.fn().mockResolvedValue([
        { toBytes: () => new Uint8Array([1]) },
        { toBytes: () => new Uint8Array([2]) },
      ]),
    } as any
    const respond = jest.spyOn(wallet, 'respondSessionRequest').mockReturnValue(undefined)
    await wallet.hedera_signAndExecuteQuery(requestId, requestTopic, query, hederaWallet)
    expect(respond).toHaveBeenCalled()
  })
})
