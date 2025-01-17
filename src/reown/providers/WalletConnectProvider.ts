import {
  IUniversalProvider,
  RpcProviderMap,
  NamespaceConfig,
} from '@walletconnect/universal-provider'
import { SessionTypes, SignClientTypes } from '@walletconnect/types'
import SignClient from '@walletconnect/sign-client'
import { DAppConnector } from '../../lib/dapp'
import { JsonRpcResult, RequestArguments } from '@walletconnect/jsonrpc-types'
import { LedgerId } from '@hashgraph/sdk'
import { EventEmitter } from 'events'
import { DefaultLogger } from '../../lib/shared/logger'

export class WalletConnectProvider extends EventEmitter implements IUniversalProvider {
  // @ts-ignore
  public client: SignClient
  public namespaces?: NamespaceConfig
  public rpcProviders: RpcProviderMap = {}
  public session?: SessionTypes.Struct
  public uri: string | undefined
  public events = new EventEmitter()
  public logger = new DefaultLogger('debug', 'ReownWalletConnectAdapter')
  public name = 'hedera'
  public shouldAbortPairingAttempt = false
  public connected = false
  public connecting = false
  public abortPairingAttempt = () => {}
  public providerOpts = {}
  public readonly protocol = 'wc'
  public readonly version = 2
  public maxPairingAttempts = 3
  public disableProviderPing = false

  public dappConnector: DAppConnector
  private chainId: string

  static async init(metadata: SignClientTypes.Metadata, network: LedgerId, projectId: string) {
    const provider = new WalletConnectProvider(metadata, network, projectId)
    await provider.initialize()
    return provider
  }

  constructor(metadata: SignClientTypes.Metadata, network: LedgerId, projectId: string) {
    super()
    this.dappConnector = new DAppConnector(metadata, network, projectId)
    this.chainId = `hedera:${network}`
  }

  get extensions() {
    return this.dappConnector.extensions
  }

  async enable(): Promise<string[]> {
    try {
      // Wait for client to be initialized if it's not ready
      if (!this.dappConnector.walletConnectClient) {
        await new Promise((resolve) => this.once('client_initialized', resolve))
      }
      this.logger.info('enabling wallet connect provider')

      const session = await this.dappConnector.openModal()
      this.session = session
      const accountId = session.namespaces.hedera?.accounts?.[0]
      if (!accountId) {
        throw new Error('No account found in session')
      }
      return [accountId]
    } catch (error) {
      console.error('Error in enable:', error)
      throw error
    }
  }

  async authenticate(params: { message: string }): Promise<string> {
    if (!this.session) {
      throw new Error('Session not established')
    }
    const signer = this.dappConnector.signers.find(
      (signer) => signer.topic === this?.session?.topic,
    )
    if (!signer) {
      throw new Error('Signer not found')
    }
    const messageResult = await this.dappConnector.signMessage({
      signerAccountId: signer.getAccountId().toString(),
      message: params.message,
    })
    return messageResult.result.signatureMap
  }

  async createSession(params?: { namespaces?: NamespaceConfig }): Promise<void> {
    this.logger.info('creating session')
    await this.dappConnector.openModal()
  }

  async approveSession(params: { namespaces: NamespaceConfig }): Promise<void> {
    this.namespaces = params.namespaces
  }

  async rejectSession(params: { message: string }): Promise<void> {
    await this.dappConnector.disconnectAll()
  }

  async updateSession(params: { namespaces: NamespaceConfig }): Promise<void> {
    this.namespaces = params.namespaces
  }

  async extendSession(): Promise<void> {
    // No direct equivalent in DAppConnector
  }

  async setDefaultChain(chainId: string, rpcUrl?: string | undefined): Promise<void> {
    this.chainId = chainId
  }

  async requestAccounts(): Promise<string[]> {
    const signers = this.dappConnector.signers
    return signers.map((signer) => signer.getAccountId().toString())
  }

  async getDefaultChain(): Promise<string> {
    return this.chainId
  }

  async getChainId(): Promise<string> {
    return this.chainId
  }

  async checkInstalled(chains: string[]): Promise<boolean> {
    return true // Hedera doesn't have a concept of "installed"
  }

  async checkPending(params: { topic: string }): Promise<boolean> {
    return false // No direct equivalent in DAppConnector
  }

  async cleanupPendingPairings(params?: { deletePairings: boolean }): Promise<void> {
    await this.dappConnector.disconnectAll()
  }

  async getPendingSessionRequests(): Promise<any[]> {
    return [] // No direct equivalent in DAppConnector
  }

  async request<T = unknown>(args: RequestArguments, chain?: string): Promise<T> {
    const result = await this.dappConnector.request({
      method: args.method,
      params: args.params,
    })
    return result.result as T
  }

  sendAsync(
    args: RequestArguments,
    callback: (error: Error | null, response: JsonRpcResult) => void,
    chain?: string,
  ): void {
    this.request(args, chain)
      .then((result) => callback(null, { id: 1, jsonrpc: '2.0', result }))
      .catch((error) => callback(error, { id: 1, jsonrpc: '2.0', result: null }))
  }

  async init(): Promise<void> {
    await this.dappConnector.init()
  }

  async pair(pairingTopic: string | undefined): Promise<SessionTypes.Struct> {
    this.logger.info('pairing')
    await this.init()
    const session = await this.dappConnector.openModal(pairingTopic)
    this.session = session
    return session
  }

  async connect(opts: {
    pairingTopic?: string
    extensionId?: string
  }): Promise<SessionTypes.Struct | undefined> {
    try {
      this.logger.info('connecting', opts)
      // Wait for client to be initialized if it's not ready
      if (!this.dappConnector.walletConnectClient) {
        await new Promise((resolve) => this.once('client_initialized', resolve))
      }

      let session: SessionTypes.Struct
      if (opts.extensionId) {
        // Connect using extension
        session = await this.dappConnector.connectExtension(opts.extensionId)
      } else {
        // Connect using WalletConnect
        session = await this.dappConnector.connect(
          (uri) => this.emit('display_uri', uri),
          opts.pairingTopic,
        )
      }

      this.session = session
      this.emit('connect', { session })
      return session
    } catch (error) {
      console.error('Error in connect:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.dappConnector.disconnect(this.session.topic)
      this.session = undefined
    }
  }

  async checkStorage(): Promise<void> {
    // No-op as we don't use storage in the same way
  }

  async initialize(): Promise<void> {
    // DAppConnector handles initialization
    try {
      await this.dappConnector.init()
      this.client = this.dappConnector.walletConnectClient!
      this.emit('client_initialized')
    } catch (error) {
      console.error('Failed to initialize DAppConnector:', error)
    }
  }

  async createClient(params?: SignClientTypes.Options): Promise<SignClient> {
    // DAppConnector handles client creation
    await this.dappConnector.init()
    return this.dappConnector.walletConnectClient as SignClient
  }

  async createProviders(params?: { chainId?: string }): Promise<void> {
    // No-op as we don't use multiple providers
  }

  async loadConnectOpts(params?: { chainId?: string }): Promise<void> {
    // No-op as we don't use connect options
  }

  async loadSession(params?: { chainId?: string }): Promise<void> {
    // No-op as session is handled by DAppConnector
  }

  async generateUri(params: { chainId?: string }): Promise<string> {
    // URI generation is handled by DAppConnector
    return ''
  }

  async subscribeToProviderEvents(): Promise<void> {
    // Event subscription is handled by DAppConnector
  }

  async checkPendingSessionRequests(): Promise<void> {
    // No-op as pending sessions are handled by DAppConnector
  }

  async deleteCachedProvider(params: { chainId: string }): Promise<void> {
    // No-op as we don't cache providers
  }

  async getProvider(params: { chainId: string }): Promise<IUniversalProvider | undefined> {
    // We don't use multiple providers
    return undefined
  }

  async setDefaultProvider(params: { chainId: string }): Promise<void> {
    // No-op as we don't use multiple providers
  }

  // Event handling through EventEmitter
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    super.on(event, listener)
    return this
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    super.once(event, listener)
    return this
  }

  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    super.removeListener(event, listener)
    return this
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    super.off(event, listener)
    return this
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  get isWalletConnect() {
    return false
  }
}
