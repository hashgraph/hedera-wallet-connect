import {
  JsonRpcProvider,
  Wallet,
  BaseWallet as BaseEvmWallet,
  TransactionRequest,
  TransactionResponse,
  JsonRpcTransactionRequest,
  Transaction,
} from 'ethers'

import {
  formatJsonRpcError,
  formatJsonRpcResult,
  JsonRpcError,
  JsonRpcResult,
} from '@walletconnect/jsonrpc-utils'
import { getSdkError } from '@walletconnect/utils'
import {
  Eip155JsonRpcMethod,
  HederaChainDefinition,
  WalletRequestEventArgs,
  getSignParamsMessage,
  getSignTypedDataParamsData,
} from '..'
/**
 * Types
 */
interface IInitArgs {
  privateKey?: string
}

export interface EIP155WalletInterface {
  getPrivateKey(): string
  getEvmAddress(): string
  connect(provider: JsonRpcProvider): BaseEvmWallet
  approveSessionRequest(
    requestEvent: WalletRequestEventArgs,
  ): Promise<JsonRpcResult<any> | JsonRpcError>
  rejectSessionRequest(requestEvent: WalletRequestEventArgs): JsonRpcError
  [Eip155JsonRpcMethod.PersonalSign](message: string): Promise<string>
  [Eip155JsonRpcMethod.Sign](message: string): Promise<string>
  [Eip155JsonRpcMethod.SignTypedData](domain: any, types: any, data: any): Promise<string>
  [Eip155JsonRpcMethod.SignTypedDataV3](domain: any, types: any, data: any): Promise<string>
  [Eip155JsonRpcMethod.SignTypedDataV4](domain: any, types: any, data: any): Promise<string>
  [Eip155JsonRpcMethod.SignTransaction](
    transaction: JsonRpcTransactionRequest,
    provider: JsonRpcProvider,
  ): Promise<string>
  [Eip155JsonRpcMethod.SendTransaction](
    transaction: JsonRpcTransactionRequest,
    provider: JsonRpcProvider,
  ): Promise<TransactionResponse>
  [Eip155JsonRpcMethod.SendRawTransaction](
    rawTransaction: string,
    provider: JsonRpcProvider,
  ): Promise<TransactionResponse>
}

/**
 * Library
 */
export class EIP155Wallet implements EIP155WalletInterface {
  wallet: BaseEvmWallet

  constructor(wallet: BaseEvmWallet) {
    this.wallet = wallet
  }
  connect(provider: JsonRpcProvider): BaseEvmWallet {
    return this.wallet.connect(provider)
  }
  personal_sign(message: string): Promise<string> {
    return this.eth_sign(message)
  }
  eth_sign(message: string): Promise<string> {
    return this.wallet.signMessage(message)
  }
  eth_signTypedData(domain: any, types: any, data: any): Promise<string> {
    return this.wallet.signTypedData(domain, types, data)
  }
  eth_signTypedData_v3(domain: any, types: any, data: any): Promise<string> {
    return this.eth_signTypedData(domain, types, data)
  }
  eth_signTypedData_v4(domain: any, types: any, data: any): Promise<string> {
    return this.eth_signTypedData(domain, types, data)
  }
  async eth_signTransaction(
    transaction: JsonRpcTransactionRequest,
    provider: JsonRpcProvider,
  ): Promise<string> {
    // Populate transaction
    const preparedTransaction = await this.connect(provider).populateTransaction(
      transaction as TransactionRequest,
    )
    delete preparedTransaction.from
    const txObj = Transaction.from(preparedTransaction)

    return this.wallet.signTransaction(txObj)
  }
  eth_sendTransaction(
    transaction: JsonRpcTransactionRequest,
    provider: JsonRpcProvider,
  ): Promise<TransactionResponse> {
    return this.connect(provider).sendTransaction(transaction as TransactionRequest)
  }
  eth_sendRawTransaction(
    rawTransaction: string,
    provider: JsonRpcProvider,
  ): Promise<TransactionResponse> {
    return provider.broadcastTransaction(rawTransaction)
  }

  static init({ privateKey }: IInitArgs) {
    const wallet = privateKey ? new Wallet(privateKey) : Wallet.createRandom()

    return new EIP155Wallet(wallet)
  }

  getPrivateKey() {
    return this.wallet.privateKey
  }

  getEvmAddress() {
    return this.wallet.address
  }

  async approveSessionRequest(requestEvent: WalletRequestEventArgs) {
    const { params, id } = requestEvent
    const { chainId, request } = params
    const networks = Object.values(HederaChainDefinition.EVM)
    const caipNetwork = networks.find((network) => network.caipNetworkId == chainId)
    if (!caipNetwork) {
      return formatJsonRpcError(id, 'Unsupported network')
    }

    switch (request.method) {
      case Eip155JsonRpcMethod.PersonalSign:
      case Eip155JsonRpcMethod.Sign:
        try {
          const message = getSignParamsMessage(request.params)
          const signedMessage = await this.eth_sign(message)
          return formatJsonRpcResult(id, signedMessage)
        } catch (error) {
          if (!(error instanceof Error)) {
            return formatJsonRpcError(id, 'Failed to sign message')
          }
          return formatJsonRpcError(id, error.message)
        }

      case Eip155JsonRpcMethod.SignTypedData:
      case Eip155JsonRpcMethod.SignTypedDataV3:
      case Eip155JsonRpcMethod.SignTypedDataV4:
        try {
          const { domain, types, message: data } = getSignTypedDataParamsData(request.params)
          // https://github.com/ethers-io/ethers.js/issues/687#issuecomment-714069471
          delete types.EIP712Domain
          const signedData = await this.eth_signTypedData(domain, types, data)
          return formatJsonRpcResult(id, signedData)
        } catch (error) {
          if (!(error instanceof Error)) {
            return formatJsonRpcError(id, 'Failed to sign typed data')
          }
          return formatJsonRpcError(id, error.message)
        }
      case Eip155JsonRpcMethod.SendRawTransaction:
      case Eip155JsonRpcMethod.SendTransaction:
        try {
          const provider = new JsonRpcProvider(caipNetwork.rpcUrls.default.http[0])
          const sendTransaction = request.params[0]
          const txResponse = await this[request.method](sendTransaction, provider)
          const txHash = typeof txResponse === 'string' ? txResponse : txResponse?.hash
          return formatJsonRpcResult(id, txHash)
        } catch (error) {
          return formatJsonRpcError(
            id,
            error instanceof Error ? error.message : 'Failed to send transaction',
          )
        }

      case Eip155JsonRpcMethod.SignTransaction:
        try {
          const provider = new JsonRpcProvider(caipNetwork.rpcUrls.default.http[0])
          const signTransaction = request.params[0]
          const signature = await this.eth_signTransaction(signTransaction, provider)
          return formatJsonRpcResult(id, signature)
        } catch (error) {
          if (!(error instanceof Error)) {
            return formatJsonRpcError(id, 'Failed to sign transaction')
          }
          return formatJsonRpcError(id, error.message)
        }
      default:
        throw new Error(getSdkError('INVALID_METHOD').message)
    }
  }

  rejectSessionRequest(requestEvent: WalletRequestEventArgs) {
    const { id } = requestEvent

    return formatJsonRpcError(id, getSdkError('USER_REJECTED').message)
  }
}
