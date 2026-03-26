import { RequestArguments } from '@reown/appkit'
import UniversalProvider, {
  IProvider,
  RpcProviderMap,
  UniversalProviderOpts,
} from '@walletconnect/universal-provider'
import { Transaction } from '@hiero-ledger/sdk'
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
  getChainId,
  mergeRequiredOptionalNamespaces,
  SUPPORTED_EIP155_CHAIN_IDS,
} from '../utils'
import HIP820Provider from './HIP820Provider'
import { createLogger } from '../../lib/shared/logger'

export class HederaProvider extends UniversalProvider {
  private hederaLogger = createLogger('HederaProvider')
  public nativeProvider?: HIP820Provider

  constructor(opts: UniversalProviderOpts) {
    super(opts)
  }
  static async init(opts: UniversalProviderOpts) {
    const provider = new HederaProvider(opts)
    //@ts-expect-error
    await provider.initialize()

    provider.namespaces = {
      //@ts-ignore
      ...(provider.providerOpts?.optionalNamespaces || {}),
      //@ts-ignore
      ...(provider.providerOpts?.requiredNamespaces || {}),
    }
    if (provider.session) provider.initProviders()
    return provider
  }

  emit(event: string, data?: unknown) {
    this.events.emit(event, data)
  }

  getAccountAddresses(): string[] {
    if (!this.session) {
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
    }

    // For non-Hedera methods, route through the base UniversalProvider
    return super.request(args, chain, expiry)
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

  // Returns the latest block number
  async eth_blockNumber() {
    return this.request<string>({ method: 'eth_blockNumber', params: [] })
  }

  // Executes a call with the given transaction request
  async eth_call(tx: Record<string, unknown>, block: string = 'latest') {
    return this.request<string>({ method: 'eth_call', params: [tx, block] })
  }

  // Returns fee history data for the given parameters
  async eth_feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: number[]) {
    return this.request<string>({
      method: 'eth_feeHistory',
      params: [blockCount, newestBlock, rewardPercentiles],
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

  public async connect(params?: any): Promise<any> {
    if (params) {
      // @ts-ignore - accessing private property
      if (params.requiredNamespaces) this.requiredNamespaces = params.requiredNamespaces
      // @ts-ignore - accessing private property
      if (params.optionalNamespaces) this.optionalNamespaces = params.optionalNamespaces
      // @ts-ignore - accessing private property
      if (params.namespaces) this.namespaces = params.namespaces
    }

    const result = await super.connect(params)
    this.initProviders()
    return result
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
      const accounts = this.session?.namespaces[namespace]?.accounts || []
      const approvedChains = getChainsFromApprovedSession(accounts)
      // Filter out non-Hedera EIP155 chains that wallets like MetaMask v11+ include in the session
      const filteredChains =
        namespace === 'eip155'
          ? approvedChains.filter((chain) => {
              const chainId = parseInt(getChainId(chain))
              const supported = SUPPORTED_EIP155_CHAIN_IDS.has(chainId)
              if (!supported) {
                this.hederaLogger.warn(`Skipping unsupported EIP155 chain: ${chain}`)
              }
              return supported
            })
          : approvedChains
      const mergedNamespaces = mergeRequiredOptionalNamespaces(
        this.namespaces,
        this.optionalNamespaces,
      )
      const combinedNamespace = {
        ...mergedNamespaces[namespace],
        accounts,
        chains: filteredChains,
        // Include rpcMap from optionalNamespaces if it exists
        ...(this.optionalNamespaces?.[namespace]?.rpcMap && {
          rpcMap: this.optionalNamespaces[namespace].rpcMap,
        }),
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
        default:
          this.hederaLogger.warn(`Skipping unsupported namespace: ${namespace}`)
      }
    })

    return providers
  }

  // @ts-expect-error - override base rpcProviders logic
  get rpcProviders(): RpcProviderMap {
    if (!this.nativeProvider) {
      return this.initProviders()
    }
    return {
      hedera: this.nativeProvider!,
    }
  }

  set rpcProviders(_: RpcProviderMap) {}
}
