import { Client, Transaction, PrivateKey, AccountId, ClientNetworkName } from '@hashgraph/sdk'
import {
  HederaSignAndExecuteTransactionResponse,
  HederaSignAndReturnTransactionResponse,
  HederaSignMessageResponse,
} from '../types'

type HederaWalletOptions = {
  accountId: AccountId
  privateKey: PrivateKey
  network: ClientNetworkName
}

type InitOptions = {
  accountId: ConstructorParameters<typeof AccountId>[0] | string
  privateKey: string
  network: ClientNetworkName
}

export class HederaWallet {
  private _client: Client
  private _accountId: AccountId
  private _privateKey: PrivateKey

  public constructor({ accountId, privateKey, network }: HederaWalletOptions) {
    this._accountId = accountId
    this._privateKey = privateKey
    this._client = this._initClient({ accountId, privateKey, network })
  }

  private _getClientForNetork(network: ClientNetworkName): Client | null {
    switch (network) {
      case 'mainnet':
        return Client.forMainnet()
      case 'previewnet':
        return Client.forPreviewnet()
      case 'testnet':
        return Client.forTestnet()
      default:
        return null
    }
  }

  private _initClient({ accountId, privateKey, network }: HederaWalletOptions) {
    const client = this._getClientForNetork(network)
    if (!client) {
      throw new Error(`Failed to intialize Hedera client for network: ${network}`)
    }
    client.setOperator(accountId, privateKey)
    return client
  }

  /**
   * A convenience wrapper for the `HederaWallet` constructor. If more control over the `accountId`
   * and `privateKey` values are needed, the requisite parameters can be built and passed directly
   * to the class's constructor.
   *
   * InitOptions:
   * - `accountId`: The "account" portion of a Hedera address `{shardNum}.{realmNum}.{account}` - e.g. 1234 from "0.0.1234"
   * - `privateKey`: A hex-encoded string. Requires DER header
   * - `network`: One of "mainnet", "previewnet", or "testnet"
   *
   * @param options - InitOptions
   * @returns HederaWallet instance
   * @example
   * ```js
   * const wallet = HederaWallet.init({
   *   network: 'mainnet',
   *   accountId: 12345, // or '0.0.12345'
   *   privateKey: securelyFetchPrivateKey(), // '30300201...',
   * })
   * ```
   */
  public static init({ accountId, privateKey, network }: InitOptions) {
    // If `accountId` is a string, attempt to pop the "account" portion from the address
    const accountEntityId =
      typeof accountId === 'string' ? Number(accountId.split('.').pop()) : accountId

    if (!accountEntityId) {
      throw new Error(`Unable to determine account number from accountId: ${accountId}`)
    }

    return new HederaWallet({
      network,
      accountId: new AccountId(accountEntityId),
      privateKey: PrivateKey.fromString(privateKey),
    })
  }

  public get accountId() {
    return this._accountId
  }

  public get client() {
    return this._client
  }

  public async signAndExecuteTransaction(
    transaction: Transaction,
  ): Promise<HederaSignAndExecuteTransactionResponse> {
    const signedTransaction = await transaction.sign(this._privateKey)
    const response = await signedTransaction.execute(this._client)
    const receipt = await response.getReceipt(this._client)
    return {
      response: response.toJSON(),
      receipt,
    }
  }

  public async signAndReturnTransaction(
    transaction: Transaction,
    type: string,
  ): Promise<HederaSignAndReturnTransactionResponse> {
    const signedTransaction = await transaction.sign(this._privateKey)
    const signedTransactionBytes = signedTransaction.toBytes()
    const encodedTransactionBytes = Buffer.from(signedTransactionBytes).toString('base64')
    return {
      transaction: {
        type,
        bytes: encodedTransactionBytes,
      },
    }
  }

  public signMessage(bytes: string): HederaSignMessageResponse {
    const buf = Buffer.from(bytes, 'base64')
    const signedMessage = this._privateKey.sign(buf)
    return {
      signature: Buffer.from(signedMessage).toString('base64'),
    }
  }
}
