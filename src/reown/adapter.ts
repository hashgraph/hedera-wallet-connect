import { AdapterBlueprint } from '@reown/appkit/adapters'
import {
  ConnectionControllerClient,
  CoreHelperUtil,
  NetworkControllerClient,
  type ConnectorType,
  type Provider,
} from '@reown/appkit-core'
import { Connector, type AppKit, type AppKitOptions } from '@reown/appkit'
import { LedgerId, Transaction } from '@hashgraph/sdk'
import { WalletConnectProvider } from './providers/WalletConnectProvider'
import { ExtensionData } from '../lib/shared'
import { SessionTypes } from '@walletconnect/types'
import { mainnetConfig, testnetConfig } from './utils/chains'
import { HederaConnectionController } from './controllers/HederaConnectionController'
import { HederaNetworkControllerClient } from './controllers/HederaNetworkControllerClient'

export interface HederaAdapterOptions extends AppKitOptions {
  projectId: string
  chainId: LedgerId
  provider?: WalletConnectProvider
}

export class HederaAdapter extends AdapterBlueprint {
  // @ts-ignore
  public provider?: WalletConnectProvider
  public networkControllerClient?: NetworkControllerClient
  public connectionControllerClient?: ConnectionControllerClient
  private chainId: LedgerId
  private extensions: ExtensionData[] = []
  private extensionCheckInterval: NodeJS.Timeout | null = null
  private hasCalledExtensionCallback = false

  private isSupportedChainId(chainId: string): boolean {
    const supportedIds = ['eip155:295', 'eip155:296']
    return supportedIds.includes(chainId)
  }

  constructor(options: HederaAdapterOptions) {
    super({
      namespace: 'eip155' as const,
      networks: [mainnetConfig, testnetConfig],
      projectId: options.projectId,
    })
    this.provider = options.provider
    this.chainId = options.chainId
  }

  public async syncConnectors(options: AppKitOptions, appKit: AppKit) {
    if (!options.projectId) {
      throw new Error('Project ID is required')
    }

    if (!options.metadata) {
      throw new Error('Metadata is required')
    }

    if (!this.namespace) {
      throw new Error('Please configure a namespace')
    }

    this.provider =
      this.provider ??
      (await WalletConnectProvider.init(options.metadata, this.chainId, options.projectId))

    const networkControllerClient = new HederaNetworkControllerClient(this)
    const connectionControllerClient = new HederaConnectionController(this)

    this.networkControllerClient = networkControllerClient
    this.connectionControllerClient = connectionControllerClient

    // Add the WalletConnect connector with both networks
    this.addConnector({
      id: 'hedera-wallet',
      type: 'WALLET_CONNECT' as ConnectorType,
      provider: this.provider as unknown as Provider,
      name: 'Hedera Wallet Connect',
      chain: this.namespace,
      chains: [mainnetConfig, testnetConfig],
      info: {
        name: 'Hedera Wallet Connect',
        rdns: 'hedera-wallet',
        icon: 'https://reown.xyz/logo.png',
      },
    })

    // Subscribe to extensions
    this.subscribeToExtensions((extensions) => {
      extensions.forEach((ext) => {
        const newConnector: Connector = {
          id: ext.id,
          type: 'INJECTED' as ConnectorType,
          provider: this.provider as unknown as Provider,
          name: ext.name,
          chain: this.namespace!,
          imageUrl: ext.icon,
          info: {
            name: ext.name,
            icon: ext.icon,
            rdns: ext.id,
            uuid: ext.id,
          },
        }
        this.provider?.logger.info('Adding extension connector:', ext, newConnector)
        this.addConnector({
          ...newConnector,
          chains: [mainnetConfig, testnetConfig],
        })
        appKit.addConnector({
          ...newConnector,
        })
      })
    })
  }

  private subscribeToExtensions(callback: (extensions: ExtensionData[]) => void) {
    if (this.extensionCheckInterval) {
      clearInterval(this.extensionCheckInterval)
    }
    this.hasCalledExtensionCallback = false

    this.extensionCheckInterval = setInterval(() => {
      const discoveredExtensions = this.provider?.extensions || []
      const allExtensions = [
        ...this.extensions,
        ...discoveredExtensions.filter((ext) => !this.extensions.some((e) => e.id === ext.id)),
      ]

      // this.provider?.logger.info('Extensions:', allExtensions, this.provider)
      const availableExtensions = allExtensions.filter((ext) => ext.available)

      if (availableExtensions.length > 0 && !this.hasCalledExtensionCallback) {
        this.hasCalledExtensionCallback = true
        callback(availableExtensions)

        if (this.extensionCheckInterval) {
          clearInterval(this.extensionCheckInterval)
          this.extensionCheckInterval = null
        }
      }
    }, 1000)

    return () => {
      if (this.extensionCheckInterval) {
        clearInterval(this.extensionCheckInterval)
        this.extensionCheckInterval = null
      }
      this.hasCalledExtensionCallback = false
    }
  }

  async connect(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      this.provider.logger.info('Starting connection process...', params)
      let session: SessionTypes.Struct | undefined

      if (params.type === 'INJECTED') {
        session = await this.provider.connect({
          extensionId: params.id,
        })
      } else {
        session = await this.provider.connect({})
      }

      this.provider?.logger.info('Got session:', session)

      if (!session) {
        throw new Error('Failed to establish session')
      }

      if (!session.namespaces?.hedera?.accounts?.length) {
        this.provider?.logger.error('Session namespaces:', session.namespaces)
        throw new Error('No Hedera accounts found in session')
      }

      const accountId = session.namespaces.hedera.accounts[0]
      const actualAccountId = accountId.split(':').pop()

      // Use the chainId from params if provided, otherwise use the current chainId
      const chainId =
        params.chainId || (this.chainId === LedgerId.MAINNET ? 'eip155:295' : 'eip155:296')

      console.log('Connection successful:', { accountId, chainId, actualAccountId })

      return {
        address: actualAccountId!,
        chainId,
        provider: this.provider as unknown as Provider,
        type: params.type as ConnectorType,
        id: params.id,
      }
    } catch (error) {
      console.error('Error in connect:', error)
      throw error
    }
  }

  async connectWalletConnect(onUri: (uri: string) => void): Promise<void> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      this.provider.logger.info('Setting up WalletConnect URI listener')

      const uriListener = (uri: string) => {
        this.provider?.logger?.info('Got WalletConnect URI:', uri)
        onUri(uri)
        return true
      }

      // Remove any existing listeners to prevent duplicates
      this.provider.removeListener('display_uri', uriListener)

      // Set up event listeners before initiating connection
      this.provider.on('display_uri', uriListener)

      // Small delay to ensure listener is set up
      await new Promise((resolve) => setTimeout(resolve, 100))

      await this.provider.connect({})
    } catch (error) {
      console.error('Error in connectWalletConnect:', error)
      throw error
    }
  }

  async disconnect(params?: AdapterBlueprint.DisconnectParams): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    await this.provider.disconnect()
    this.emit('disconnect')
  }

  async switchNetwork(params: AdapterBlueprint.SwitchNetworkParams): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    const targetChainId = params.caipNetwork.id.toString()
    if (!this.isSupportedChainId(targetChainId)) {
      throw new Error(`Network ${targetChainId} is not supported`)
    }

    // Update chainId based on the CAIP format
    this.chainId = targetChainId === 'eip155:295' ? LedgerId.MAINNET : LedgerId.TESTNET

    // Disconnect current session before switching
    await this.disconnect()

    // Reconnect with new network
    await this.connect({
      id: params.caipNetwork.id.toString(),
      type: 'WALLET_CONNECT',
      chainId: targetChainId,
    })
  }

  async getAccounts(
    params: AdapterBlueprint.GetAccountsParams,
  ): Promise<AdapterBlueprint.GetAccountsResult> {
    console.log('getAccounts')

    const session = this.provider?.session
    if (!session || !params.namespace) {
      return {
        accounts: [],
      }
    }

    const addresses = session.namespaces[params.namespace]?.accounts

    const accounts = addresses?.map((address) =>
      CoreHelperUtil.createAccount(params.namespace, address, 'eoa'),
    )

    return {
      accounts: accounts || [],
    }
  }

  async getBalance(
    params: AdapterBlueprint.GetBalanceParams,
  ): Promise<AdapterBlueprint.GetBalanceResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    const balance = '0'

    return {
      balance: balance as string,
      symbol: 'HBAR',
    }
  }

  async signMessage(
    params: AdapterBlueprint.SignMessageParams,
  ): Promise<AdapterBlueprint.SignMessageResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    const signature = await this.provider.request({
      method: 'hedera_signMessage',
      params: [params.message],
    })

    return { signature: signature as string }
  }

  async sendTransaction(
    params: AdapterBlueprint.SendTransactionParams,
  ): Promise<AdapterBlueprint.SendTransactionResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    const result = await this.provider.request({
      method: 'hedera_executeTransaction',
      params: [params as unknown as Transaction],
    })

    return { hash: (result as any).transactionId.toString() }
  }

  async getProfile(): Promise<AdapterBlueprint.GetProfileResult> {
    try {
      const accounts = await this.provider?.requestAccounts()
      if (!accounts?.length) {
        return { profileName: undefined, profileImage: undefined }
      }

      const accountId = accounts[0].split(':').pop()
      if (!accountId) {
        return { profileName: undefined, profileImage: undefined }
      }

      const response = await fetch(`https://api.hashpack.app/api/v1/profile/${accountId}`)
      if (!response.ok) {
        return { profileName: undefined, profileImage: undefined }
      }

      const profile = await response.json()
      return {
        profileName: profile.username?.name || profile.accountId,
        profileImage: profile.profilePicture?.thumbUrl || undefined,
      }
    } catch (error) {
      console.error('Error fetching HashPack profile:', error)
      return { profileName: undefined, profileImage: undefined }
    }
  }

  async syncConnection(
    params: AdapterBlueprint.SyncConnectionParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    return this.connect({
      id: params.id,
      type: 'WALLET_CONNECT',
      chainId: params.chainId,
    })
  }

  async estimateGas(): Promise<AdapterBlueprint.EstimateGasTransactionResult> {
    return { gas: BigInt(0) }
  }

  async writeContract(): Promise<AdapterBlueprint.WriteContractResult> {
    throw new Error('Contract interactions not supported on Hedera')
  }

  async getEnsAddress(
    params: AdapterBlueprint.GetEnsAddressParams,
  ): Promise<AdapterBlueprint.GetEnsAddressResult> {
    return { address: params.name }
  }

  parseUnits(): bigint {
    return BigInt(0)
  }

  formatUnits(): string {
    return ''
  }

  async getCapabilities(): Promise<unknown> {
    return {}
  }

  async grantPermissions(): Promise<unknown> {
    return {}
  }

  async revokePermissions(): Promise<`0x${string}`> {
    return '0x'
  }

  async requestAccounts(): Promise<string[]> {
    const signers = this.provider?.dappConnector.signers || []
    return signers.map((signer) => signer.getAccountId().toString())
  }

  getWalletConnectProvider(): Provider {
    return this.provider as unknown as Provider
  }
}
