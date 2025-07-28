import {
  BrowserProvider,
  Contract,
  JsonRpcSigner,
  TransactionRequest,
  hexlify,
  isHexString,
  toQuantity,
  toUtf8Bytes,
} from 'ethers'
import { CaipNetwork, RequestArguments } from '@reown/appkit'
import type {
  EstimateGasTransactionArgs,
  SendTransactionArgs,
  WriteContractArgs,
} from '@reown/appkit'
import UniversalProvider, {
  IProvider,
  RpcProviderMap,
  UniversalProviderOpts,
} from '@walletconnect/universal-provider'
import { Transaction } from '@hashgraph/sdk'
import {
  GetNodeAddressesResult,
  ExecuteTransactionParams,
  ExecuteTransactionResult,
  SignMessageParams,
  SignMessageResult,
  SignAndExecuteQueryParams,
  SignAndExecuteQueryResult,
  SignAndExecuteTransactionParams,
  SignAndExecuteTransactionResult,
  SignTransactionParams,
  SignTransactionResult,
  HederaJsonRpcMethod,
} from '../..'
import {
  EthFilter,
  getChainsFromApprovedSession,
  mergeRequiredOptionalNamespaces,
} from '../utils'
import HIP820Provider from './HIP820Provider'
import EIP155Provider from './EIP155Provider'

export type HederaWalletConnectProviderConfig = {
  chains: CaipNetwork[]
} & UniversalProviderOpts

// Reown AppKit UniversalProvider for HIP-820 & EIP-155 version implementation of the @hashgraph/hedera-wallet-connect DAppConnector
export class HederaProvider extends UniversalProvider {
  public nativeProvider?: HIP820Provider
  public eip155Provider?: EIP155Provider

  constructor(opts: UniversalProviderOpts) {
    super(opts)
  }
  static async init(opts: UniversalProviderOpts) {
    const provider = new HederaProvider(opts)

    //@ts-expect-error - private base method
    await provider.initialize()
    provider.namespaces = {
      ...(provider.namespaces?.eip155
        ? {
            eip155: {
              ...provider.namespaces?.eip155,
              rpcMap: provider.optionalNamespaces?.eip155.rpcMap,
            },
          }
        : {}),
      ...(provider.namespaces?.hedera
        ? {
            hedera: {
              ...provider.namespaces?.hedera,
              rpcMap: provider.optionalNamespaces?.hedera.rpcMap,
            },
          }
        : {}),
    }
    if (provider.session) provider.initProviders()
    return provider
  }

  emit(event: string, data?: unknown) {
    this.events.emit(event, data)
  }

  getAccountAddresses(): string[] {
    if (!this.session || !this.namespaces) {
      throw new Error('Not initialized. Please call connect()')
    }

    return Object.values(this.session.namespaces).flatMap(
      (namespace) => namespace.accounts.map((account) => account.split(':')[2]) ?? [],
    )
  }

  override async request<T = unknown>(
    args: RequestArguments,
    chain?: string | undefined,
    expiry?: number | undefined,
  ): Promise<T> {
    if (!this.session || !this.namespaces) {
      throw new Error('Please call connect() before request()')
    }
    let chainId = chain
    if (Object.values(HederaJsonRpcMethod).includes(args.method as HederaJsonRpcMethod)) {
      if (!this.nativeProvider) {
        throw new Error('nativeProvider not initialized. Please call connect()')
      }
      chainId = chainId ?? this.namespaces.hedera?.chains[0]

      return this.nativeProvider?.request({
        request: {
          ...args,
        },
        chainId: chainId!,
        topic: this.session.topic,
        expiry,
      })
    } else {
      if (!this.eip155Provider) {
        throw new Error('eip155Provider not initialized')
      }
      chainId = chainId ?? this.namespaces.eip155?.chains[0]

      return this.eip155Provider?.request({
        request: {
          ...args,
        },
        chainId: chainId!,
        topic: this.session.topic,
        expiry,
      })
    }
  }

  /**
   * Retrieves the node addresses associated with the current Hedera network.
   *
   * When there is no active session or an error occurs during the request.
   * @returns Promise\<{@link GetNodeAddressesResult}\>
   */
  async hedera_getNodeAddresses() {
    return await this.request<GetNodeAddressesResult['result']>({
      method: HederaJsonRpcMethod.GetNodeAddresses,
      params: undefined,
    })
  }

  /**
   * Executes a transaction on the Hedera network.
   *
   * @param {ExecuteTransactionParams} params - The parameters of type {@link ExecuteTransactionParams | `ExecuteTransactionParams`} required for the transaction execution.
   * @param {string[]} params.signedTransaction - Array of Base64-encoded `Transaction`'s
   * @returns Promise\<{@link ExecuteTransactionResult}\>
   * @example
   * Use helper `transactionToBase64String` to encode `Transaction` to Base64 string
   * ```ts
   * const params = {
   *  signedTransaction: [transactionToBase64String(transaction)]
   * }
   *
   * const result = await dAppConnector.executeTransaction(params)
   * ```
   */
  async hedera_executeTransaction(params: ExecuteTransactionParams) {
    return await this.request<ExecuteTransactionResult['result']>({
      method: HederaJsonRpcMethod.ExecuteTransaction,
      params,
    })
  }

  /**
   * Signs a provided `message` with provided `signerAccountId`.
   *
   * @param {SignMessageParams} params - The parameters of type {@link SignMessageParams | `SignMessageParams`} required for signing message.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string} params.message - a plain UTF-8 string
   * @returns Promise\<{@link SignMessageResult}\>
   * @example
   * ```ts
   * const params = {
   *  signerAccountId: 'hedera:testnet:0.0.12345',
   *  message: 'Hello World!'
   * }
   *
   * const result = await dAppConnector.signMessage(params)
   * ```
   */
  async hedera_signMessage(params: SignMessageParams) {
    return await this.request<SignMessageResult['result']>({
      method: HederaJsonRpcMethod.SignMessage,
      params,
    })
  }

  /**
   * Signs and send `Query` on the Hedera network.
   *
   * @param {SignAndExecuteQueryParams} params - The parameters of type {@link SignAndExecuteQueryParams | `SignAndExecuteQueryParams`} required for the Query execution.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string} params.query - `Query` object represented as Base64 string
   * @returns Promise\<{@link SignAndExecuteQueryResult}\>
   * @example
   * Use helper `queryToBase64String` to encode `Query` to Base64 string
   * ```ts
   * const params = {
   *  signerAccountId: '0.0.12345',
   *  query: queryToBase64String(query),
   * }
   *
   * const result = await dAppConnector.signAndExecuteQuery(params)
   * ```
   */
  async hedera_signAndExecuteQuery(params: SignAndExecuteQueryParams) {
    return await this.request<SignAndExecuteQueryResult['result']>({
      method: HederaJsonRpcMethod.SignAndExecuteQuery,
      params,
    })
  }

  /**
   * Signs and executes Transactions on the Hedera network.
   *
   * @param {SignAndExecuteTransactionParams} params - The parameters of type {@link SignAndExecuteTransactionParams | `SignAndExecuteTransactionParams`} required for `Transaction` signing and execution.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {string[]} params.transaction - Array of Base64-encoded `Transaction`'s
   * @returns Promise\<{@link SignAndExecuteTransactionResult}\>
   * @example
   * Use helper `transactionToBase64String` to encode `Transaction` to Base64 string
   * ```ts
   * const params = {
   *  signerAccountId: '0.0.12345'
   *  transaction: [transactionToBase64String(transaction)]
   * }
   *
   * const result = await dAppConnector.signAndExecuteTransaction(params)
   * ```
   */
  async hedera_signAndExecuteTransaction(params: SignAndExecuteTransactionParams) {
    return await this.request<SignAndExecuteTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignAndExecuteTransaction,
      params,
    })
  }

  /**
   * Signs and executes Transactions on the Hedera network.
   *
   * @param {SignTransactionParams} params - The parameters of type {@link SignTransactionParams | `SignTransactionParams`} required for `Transaction` signing.
   * @param {string} params.signerAccountId - a signer Hedera Account identifier in {@link https://hips.hedera.com/hip/hip-30 | HIP-30} (`<nework>:<shard>.<realm>.<num>`) form.
   * @param {Transaction} params.transactionBody - a Transaction object built with the @hgraph/sdk
   * @returns Promise\<{@link SignTransactionResult}\>
   * @example
   * ```ts
   *
   * const params = {
   *  signerAccountId: '0.0.12345',
   *  transactionBody
   * }
   *
   * const result = await dAppConnector.signTransaction(params)
   * ```
   */
  async hedera_signTransaction(params: SignTransactionParams) {
    if (!this.session) {
      throw new Error('Session not initialized. Please call connect()')
    }
    if (!this.nativeProvider) {
      throw new Error('nativeProvider not initialized. Please call connect()')
    }
    if (!(params?.transactionBody instanceof Transaction)) {
      throw new Error(
        'Transaction sent in incorrect format. Ensure transaction body is a Transaction object.',
      )
    }

    const signerAccountId = params?.signerAccountId?.split(':')?.pop()
    const isValidSigner = this.nativeProvider?.requestAccounts().includes(signerAccountId ?? '')

    if (!isValidSigner) {
      throw new Error(`Signer not found for account ${signerAccountId}`)
    }

    return (await this.nativeProvider.signTransaction(
      params.transactionBody as Transaction,
      this.session.topic,
    ))!
  }

  async eth_signMessage(message: string, address: string) {
    const hexMessage = isHexString(message) ? message : hexlify(toUtf8Bytes(message))
    const signature = await this.request({
      method: 'personal_sign',
      params: [hexMessage, address],
    })

    return signature as `0x${string}`
  }

  async eth_estimateGas(data: EstimateGasTransactionArgs, address: string, networkId: number) {
    if (!address) {
      throw new Error('estimateGas - address is undefined')
    }
    if (data.chainNamespace !== 'eip155') {
      throw new Error('estimateGas - chainNamespace is not eip155')
    }

    const txParams = {
      from: data.address,
      to: data.to,
      data: data.data,
      type: 0,
    }
    const browserProvider = new BrowserProvider(this, networkId)
    const signer = new JsonRpcSigner(browserProvider, address)

    return await signer.estimateGas(txParams)
  }

  async eth_sendTransaction(data: SendTransactionArgs, address: string, networkId: number) {
    if (!address) {
      throw new Error('sendTransaction - address is undefined')
    }
    if (data.chainNamespace !== 'eip155') {
      throw new Error('sendTransaction - chainNamespace is not eip155')
    }

    const txParams = {
      to: data.to,
      value: data.value,
      gasLimit: data.gas,
      gasPrice: data.gasPrice,
      data: data.data,
      type: 0,
    }
    const browserProvider = new BrowserProvider(this, networkId)
    const signer = new JsonRpcSigner(browserProvider, address)
    const txResponse = await signer.sendTransaction(txParams)
    const txReceipt = await txResponse.wait()

    return (txReceipt?.hash as `0x${string}`) || null
  }

  async eth_writeContract(data: WriteContractArgs, address: string, chainId: number) {
    if (!address) {
      throw new Error('writeContract - address is undefined')
    }
    const browserProvider = new BrowserProvider(this, chainId)
    const signer = new JsonRpcSigner(browserProvider, address)
    const contract = new Contract(data.tokenAddress, data.abi, signer)
    if (!contract || !data.method) {
      throw new Error('Contract method is undefined')
    }
    const method = contract[data.method]
    if (method) {
      return (await method(...data.args)) as string
    }
    throw new Error('Contract method is undefined')
  }

  // Returns the latest block number
  async eth_blockNumber() {
    return this.request<string>({ method: 'eth_blockNumber', params: [] })
  }

  // Executes a call with the given transaction request and block identifier
  async eth_call(tx: TransactionRequest, block: string = 'latest') {
    return this.request<string>({ method: 'eth_call', params: [tx, block] })
  }

  // Returns fee history data for the given parameters
  async eth_feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: number[]) {
    return this.request<string>({
      method: 'eth_feeHistory',
      params: [toQuantity(blockCount), newestBlock, rewardPercentiles],
    })
  }

  // Returns the current gas price
  async eth_gasPrice() {
    return this.request<string>({ method: 'eth_gasPrice', params: [] })
  }

  // Returns block details by hash, optionally including full transactions
  async eth_getBlockByHash(hash: string, fullTx: boolean = false) {
    return this.request<string>({ method: 'eth_getBlockByHash', params: [hash, fullTx] })
  }

  // Returns block details by block number, optionally including full transactions
  async eth_getBlockByNumber(block: string, fullTx: boolean = false) {
    return this.request({ method: 'eth_getBlockByNumber', params: [block, fullTx] })
  }

  // Returns the number of transactions in a block identified by its hash
  async eth_getBlockTransactionCountByHash(hash: string) {
    return this.request<string>({
      method: 'eth_getBlockTransactionCountByHash',
      params: [hash],
    })
  }

  // Returns the number of transactions in a block identified by its number
  async eth_getBlockTransactionCountByNumber(block: string) {
    return this.request<string>({
      method: 'eth_getBlockTransactionCountByNumber',
      params: [block],
    })
  }

  // Returns the contract code at the specified address and block
  async eth_getCode(address: string, block: string = 'latest') {
    return this.request<string>({ method: 'eth_getCode', params: [address, block] })
  }

  // Returns filter logs based on the provided filter object
  async eth_getFilterLogs(filterId: string) {
    return this.request<string>({ method: 'eth_getFilterLogs', params: [filterId] })
  }

  // Returns filter changes for the given filter ID
  async eth_getFilterChanges(filterId: string) {
    return this.request<string>({ method: 'eth_getFilterChanges', params: [filterId] })
  }

  // Returns logs based on the provided filter object
  async eth_getLogs(filter: EthFilter) {
    return this.request<string>({ method: 'eth_getLogs', params: [filter] })
  }

  // Returns storage data at a specific address and position for a given block
  async eth_getStorageAt(address: string, position: string, block: string = 'latest') {
    return this.request<string>({
      method: 'eth_getStorageAt',
      params: [address, position, block],
    })
  }

  // Returns a transaction from a block by its hash and index
  async eth_getTransactionByBlockHashAndIndex(hash: string, index: string) {
    return await this.request<string>({
      method: 'eth_getTransactionByBlockHashAndIndex',
      params: [hash, index],
    })
  }

  // Returns a transaction from a block by its number and index
  async eth_getTransactionByBlockNumberAndIndex(block: string, index: string) {
    return this.request<string>({
      method: 'eth_getTransactionByBlockNumberAndIndex',
      params: [block, index],
    })
  }

  // Returns transaction details by its hash
  async eth_getTransactionByHash(hash: string) {
    return this.request<string>({ method: 'eth_getTransactionByHash', params: [hash] })
  }

  // Returns the transaction count for a given address and block
  async eth_getTransactionCount(address: string, block: string = 'latest') {
    return this.request<string>({
      method: 'eth_getTransactionCount',
      params: [address, block],
    })
  }

  // Returns the transaction receipt for a given transaction hash
  async eth_getTransactionReceipt(hash: string) {
    return this.request<string>({ method: 'eth_getTransactionReceipt', params: [hash] })
  }

  // Returns the current hashrate
  async eth_hashrate() {
    return this.request<string>({ method: 'eth_hashrate', params: [] })
  }

  // Returns the max priority fee per gas
  async eth_maxPriorityFeePerGas() {
    return this.request<string>({ method: 'eth_maxPriorityFeePerGas', params: [] })
  }

  // Returns the mining status
  async eth_mining() {
    return this.request<string>({ method: 'eth_mining', params: [] })
  }

  // Creates a new block filter and returns its ID
  async eth_newBlockFilter() {
    return this.request<string>({ method: 'eth_newBlockFilter', params: [] })
  }

  // Creates a new filter based on the provided filter object and returns its ID
  async eth_newFilter(filter: EthFilter) {
    return this.request<string>({ method: 'eth_newFilter', params: [filter] })
  }

  // Submits work for mining (dummy parameters) and returns the result
  async eth_submitWork(params: string[]) {
    return this.request<string>({ method: 'eth_submitWork', params })
  }

  // Returns the syncing status
  async eth_syncing() {
    return this.request<string>({ method: 'eth_syncing', params: [] })
  }

  // Uninstalls the filter with the given ID
  async eth_uninstallFilter(filterId: string) {
    return this.request<string>({ method: 'eth_uninstallFilter', params: [filterId] })
  }

  // Returns the network listening status
  async net_listening() {
    return this.request<string>({ method: 'net_listening', params: [] })
  }

  // Returns the current network version
  async net_version() {
    return this.request<string>({ method: 'net_version', params: [] })
  }

  // Returns the client version string
  async web3_clientVersion() {
    return this.request<string>({ method: 'web3_clientVersion', params: [] })
  }

  async eth_chainId() {
    return this.request<string>({ method: 'eth_chainId', params: [] })
  }

  public async pair(pairingTopic: string | undefined): ReturnType<UniversalProvider['pair']> {
    const session = await super.pair(pairingTopic)
    this.initProviders()
    return session
  }

  private initProviders(): Record<string, IProvider> {
    if (!this.client) {
      throw new Error('Sign Client not initialized')
    }

    if (!this.session || !this.namespaces) {
      return {}
    }

    const namespaces = Object.keys(this.namespaces)

    const providers: Record<string, IProvider> = {}

    namespaces.forEach((namespace) => {
      const accounts = this.session!.namespaces[namespace].accounts
      const approvedChains = getChainsFromApprovedSession(accounts)
      const mergedNamespaces = mergeRequiredOptionalNamespaces(
        this.namespaces,
        this.optionalNamespaces,
      )
      const combinedNamespace = {
        ...mergedNamespaces[namespace],
        accounts,
        chains: approvedChains,
      }

      switch (namespace) {
        case 'hedera': {
          const provider = new HIP820Provider({
            namespace: combinedNamespace,
            events: this.events,
            client: this.client,
          })
          this.nativeProvider = provider
          providers[namespace] = provider
          break
        }
        case 'eip155': {
          const provider = new EIP155Provider({
            namespace: combinedNamespace,
            events: this.events,
            client: this.client,
          })
          this.eip155Provider = provider
          providers[namespace] = provider
          break
        }
        default:
          throw new Error(`Unsupported namespace: ${namespace}`)
      }
    })

    return providers
  }

  // @ts-expect-error - override base rpcProviders logic
  get rpcProviders(): RpcProviderMap {
    if (!this.nativeProvider && !this.eip155Provider) {
      return this.initProviders()
    }
    return {
      hedera: this.nativeProvider!,
      eip155: this.eip155Provider!,
    }
  }

  set rpcProviders(_: RpcProviderMap) {}
}
