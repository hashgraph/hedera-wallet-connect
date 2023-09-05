import { AccountId, Client, ClientNetworkName, PrivateKey } from '@hashgraph/sdk'
import { HederaWallet } from '../../src'
import { defaultAccountNumber } from '../_helpers'

describe(HederaWallet.name, () => {
  describe('init', () => {
    // [networkName, accountId]
    const testCases: [ClientNetworkName, string | number][] = [
      ['mainnet', defaultAccountNumber],
      ['previewnet', defaultAccountNumber],
      ['testnet', defaultAccountNumber],
      ['mainnet', `0.0.${defaultAccountNumber}`],
      ['previewnet', `0.0.${defaultAccountNumber}`],
      ['testnet', `0.0.${defaultAccountNumber}`],
    ]
    test.each(testCases)(
      'it should initialize with a %p client and accountId %p',
      (network, accountId) => {
        const wallet = HederaWallet.init({
          accountId,
          privateKey: PrivateKey.generateED25519().toStringDer(),
          network,
        })
        expect(wallet).toBeInstanceOf(HederaWallet)
        expect(wallet.accountId.toString()).toBe(`0.0.${defaultAccountNumber}`)
        expect(wallet.client).toBeInstanceOf(Client)
      },
    )
  })

  describe('constructor', () => {
    // [AccountId, PrivateKey]
    const testCases: [AccountId, PrivateKey][] = [
      [new AccountId(defaultAccountNumber), PrivateKey.generateECDSA()],
      [
        AccountId.fromBytes(new Uint8Array([8, 0, 16, 0, 24, 185, 96])), // Array obtained from accountId.toBytes()
        PrivateKey.generateED25519(),
      ],
    ]
    test.each(testCases)(
      'it should construct with various AccountId, PrivateKey values',
      (accountId, privateKey) => {
        const wallet = new HederaWallet({ accountId, privateKey, network: 'testnet' })
        expect(wallet).toBeInstanceOf(HederaWallet)
        expect(wallet.accountId.toString()).toBe(`0.0.${defaultAccountNumber}`)
        expect(wallet.client).toBeInstanceOf(Client)
      },
    )
  })
})
