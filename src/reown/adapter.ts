import { CoreHelperUtil, CaipNetwork } from '@reown/appkit'
import { type ChainNamespace, isReownName } from '@reown/appkit-common'
import { AdapterBlueprint, WcHelpersUtil } from '@reown/appkit-controllers'
import { LedgerId } from '@hiero-ledger/sdk'
import {
  BrowserProvider,
  Contract,
  formatUnits,
  hexlify,
  isHexString,
  JsonRpcSigner,
  parseUnits,
  toUtf8Bytes,
} from 'ethers'

import { HederaProvider } from './providers'
import { HederaConnector } from './connectors'
import { hederaNamespace, getAccountBalance, HederaChainDefinition } from './utils'
import { createLogger } from '../lib/shared/logger'

interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  detail: EIP6963ProviderDetail
}

interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
  /** Set to true by Hedera-native wallets that announce via EIP-6963 but delegate connection to WalletConnect */
  isWalletConnectOnly?: boolean
}

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]
type AdapterSendTransactionParams = AdapterBlueprint.SendTransactionParams & {
  address: string
}
type GetEnsAddressParams = {
  name: string
  caipNetwork?: CaipNetwork
}
type GetEnsAddressResult = { address: string | false }
type GetProfileResult = { profileImage: string; profileName: string }

export class HederaAdapter extends AdapterBlueprint {
  private static INJECTED_DISCONNECT_KEY = '@hwc/injected-disconnected'
  private logger = createLogger('HederaAdapter')
  private injectedProviders = new Map<string, EIP1193Provider>()
  private activeInjectedProvider: EIP1193Provider | null = null

  constructor(params: HederaAdapter.Params) {
    if (params.namespace !== hederaNamespace && params.namespace !== 'eip155') {
      throw new Error('Namespace must be "hedera" or "eip155"')
    }
    if (params.namespace == 'eip155') {
      if (params.networks?.some((n) => n.chainNamespace != 'eip155')) {
        throw new Error('Invalid networks for eip155 namespace')
      }
    } else {
      if (params.networks?.some((n) => n.chainNamespace != hederaNamespace)) {
        throw new Error('Invalid networks for hedera namespace')
      }
    }
    super({
      ...params,
    })

    this.getCaipNetworks = (namespace?: ChainNamespace): CaipNetwork[] => {
      const targetNamespace = namespace || this.namespace

      if (targetNamespace === 'eip155') {
        return [HederaChainDefinition.EVM.Mainnet, HederaChainDefinition.EVM.Testnet]
      } else if (targetNamespace === hederaNamespace) {
        return [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet]
      } else {
        return [
          HederaChainDefinition.EVM.Mainnet,
          HederaChainDefinition.EVM.Testnet,
          HederaChainDefinition.Native.Mainnet,
          HederaChainDefinition.Native.Testnet,
        ]
      }
    }
  }

  public override async setUniversalProvider(
    universalProvider: UniversalProvider,
  ): Promise<void> {
    this.addConnector(
      new HederaConnector({
        provider: universalProvider,
        caipNetworks: this.getCaipNetworks() || [],
        namespace: this.namespace as 'hedera' | 'eip155',
      }),
    )
  }

  public async connect(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    this.logger.debug('connect called with params:', params)

    const type = (params as any).type as string | undefined

    if (type === 'ANNOUNCED' || type === 'INJECTED') {
      return this.connectInjected(params)
    }

    return this.connectViaWalletConnect(params)
  }

  private async connectViaWalletConnect(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    const connector = this.getWalletConnectConnector()
    if (connector && 'connectWalletConnect' in connector) {
      this.logger.debug('Calling HederaConnector.connectWalletConnect')
      await (connector as any).connectWalletConnect()
    } else {
      this.logger.warn('HederaConnector not found or connectWalletConnect method missing')
    }

    this.activeInjectedProvider = null

    return {
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: Number(params.chainId),
      provider: this.provider as UniversalProvider,
      address: '',
    }
  }

  private async connectInjected(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    const id = (params as any).id as string
    const type = (params as any).type as 'ANNOUNCED' | 'INJECTED'

    const injectedProvider =
      this.injectedProviders.get(id) ||
      ((params as any).provider as EIP1193Provider | undefined)
    if (!injectedProvider) {
      throw new Error(`Injected provider not found for id: ${id}`)
    }

    // Hedera-native wallets (e.g. Kabila) announce via EIP-6963 for discovery but
    // cannot fulfill EIP-1193 RPC calls — they require WalletConnect + HIP-820.
    if (injectedProvider.isWalletConnectOnly) {
      this.logger.debug(`connectInjected: "${id}" is WalletConnect-only, falling back to WC`)
      return this.connectViaWalletConnect(params)
    }

    this.logger.debug(`connectInjected: requesting accounts from "${id}"`)

    let accounts: string[]
    try {
      accounts = (await injectedProvider.request({
        method: 'eth_requestAccounts',
      })) as string[]
    } catch (error: any) {
      if (error?.message?.includes('already pending')) {
        // User has a pending MetaMask request — surface this so they can action it.
        this.logger.warn(
          'A wallet_requestPermissions request is already pending. ' +
            'Open the wallet extension and approve or reject the pending request.',
        )
        throw error
      }
      // Any other rejection (e.g. wallet announced via EIP-6963 but doesn't support
      // EIP-1193) — fall back to WalletConnect pairing instead of surfacing an error.
      this.logger.warn(
        `connectInjected: "${id}" rejected eth_requestAccounts (${error?.message}), falling back to WC`,
      )
      return this.connectViaWalletConnect(params)
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from injected provider')
    }

    let chainIdHex = (await injectedProvider.request({
      method: 'eth_chainId',
    })) as string
    let chainId = parseInt(chainIdHex, 16)

    const configuredNetworks = this.getCaipNetworks()
    const isChainSupported = configuredNetworks.some((n) => Number(n.id) === chainId)

    if (!isChainSupported && configuredNetworks.length > 0) {
      const targetNetwork = configuredNetworks[0]
      const targetChainIdHex = `0x${Number(targetNetwork.id).toString(16)}`

      this.logger.debug(
        `connectInjected: wallet is on chain ${chainId}, switching to ${targetNetwork.name} (${targetNetwork.id})`,
      )

      try {
        await injectedProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        })
      } catch (switchError: any) {
        // 4902: chain not added to wallet yet
        if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
          await injectedProvider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetChainIdHex,
                chainName: targetNetwork.name,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: [targetNetwork.rpcUrls.default.http[0]],
                blockExplorerUrls: targetNetwork.blockExplorers?.default?.url
                  ? [targetNetwork.blockExplorers.default.url]
                  : undefined,
              },
            ],
          })
        } else {
          throw switchError
        }
      }

      chainIdHex = (await injectedProvider.request({
        method: 'eth_chainId',
      })) as string
      chainId = parseInt(chainIdHex, 16)
    }

    this.activeInjectedProvider = injectedProvider
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HederaAdapter.INJECTED_DISCONNECT_KEY)
    }
    this.logger.debug(`connectInjected: connected to ${accounts[0]} on chain ${chainId}`)

    const connector = this.connectors.find((c) => c.id === id)

    this.emit('accountChanged', {
      address: accounts[0],
      chainId,
      connector: connector as any,
    })

    this.setupInjectedListeners(injectedProvider, id)

    return {
      id,
      type: type as any,
      provider: injectedProvider as any,
      address: accounts[0],
      chainId,
    }
  }

  private injectedListenersSet = false

  private setupInjectedListeners(provider: EIP1193Provider, connectorId: string) {
    if (this.injectedListenersSet) {
      return
    }
    this.injectedListenersSet = true

    const connector = this.connectors.find((c) => c.id === connectorId)

    const onAccountsChanged = (accounts: unknown) => {
      const addrs = accounts as string[]
      if (addrs.length === 0) {
        this.activeInjectedProvider = null
        this.emit('disconnect')
      } else {
        this.emit('accountChanged', {
          address: addrs[0],
          connector: connector as any,
        })
      }
    }

    const onChainChanged = (chainId: unknown) => {
      const newChainId =
        typeof chainId === 'string' ? parseInt(chainId, 16) : (chainId as number)
      this.emit('switchNetwork', {
        address: (this.connectors.find((c) => c.id === connectorId) as any)?.address || '',
        chainId: newChainId,
      })
    }

    provider.on?.('accountsChanged', onAccountsChanged)
    provider.on?.('chainChanged', onChainChanged)
  }

  public async disconnect(
    _params?: AdapterBlueprint.DisconnectParams,
  ): Promise<AdapterBlueprint.DisconnectResult> {
    if (this.activeInjectedProvider) {
      this.activeInjectedProvider = null
      this.injectedListenersSet = false
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HederaAdapter.INJECTED_DISCONNECT_KEY, 'true')
      }
      return { connections: [] }
    }

    try {
      const connector = this.getWalletConnectConnector()
      await connector.disconnect()
    } catch (error) {
      this.logger.warn('disconnect - error', error)
    }
    return { connections: [] }
  }

  public async getAccounts({
    namespace,
  }: AdapterBlueprint.GetAccountsParams & {
    namespace: ChainNamespace
  }): Promise<AdapterBlueprint.GetAccountsResult> {
    if (this.activeInjectedProvider) {
      const accounts = (await this.activeInjectedProvider.request({
        method: 'eth_accounts',
      })) as string[]

      return {
        accounts: accounts.map((address) =>
          CoreHelperUtil.createAccount('eip155' as ChainNamespace, address, 'eoa'),
        ),
      }
    }

    const provider = this.provider as UniversalProvider
    const addresses = (provider?.session?.namespaces?.[namespace]?.accounts
      ?.map((account) => {
        const [, , address] = account.split(':')
        return address
      })
      .filter((address, index, self) => self.indexOf(address) === index) || []) as string[]

    return {
      accounts: addresses.map((address) =>
        CoreHelperUtil.createAccount(namespace, address, 'eoa'),
      ),
    }
  }

  public async syncConnectors() {
    if (this.namespace !== 'eip155' || typeof window === 'undefined') {
      return
    }

    const handleAnnouncement = (event: Event) => {
      const e = event as EIP6963AnnounceProviderEvent
      const { info, provider } = e.detail

      if (!info?.rdns || this.injectedProviders.has(info.rdns)) {
        return
      }

      this.injectedProviders.set(info.rdns, provider)

      this.addConnector({
        id: info.rdns,
        type: 'ANNOUNCED' as const,
        name: info.name,
        info: { uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns },
        provider,
        chain: 'eip155' as ChainNamespace,
        chains: this.getCaipNetworks(),
      } as any)

      this.logger.debug(`EIP-6963: Discovered wallet "${info.name}" (${info.rdns})`)
    }

    window.addEventListener('eip6963:announceProvider', handleAnnouncement)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  }

  public async syncConnections(_params: AdapterBlueprint.SyncConnectionsParams): Promise<void> {
    return Promise.resolve()
  }

  public async getBalance(
    params: AdapterBlueprint.GetBalanceParams,
  ): Promise<AdapterBlueprint.GetBalanceResult> {
    const { address, caipNetwork } = params

    if (!caipNetwork) {
      return Promise.resolve({
        balance: '0',
        decimals: 0,
        symbol: '',
      })
    }

    const accountBalance = await getAccountBalance(
      caipNetwork.testnet ? LedgerId.TESTNET : LedgerId.MAINNET,
      address!,
    )

    return Promise.resolve({
      balance: accountBalance
        ? formatUnits(accountBalance.hbars.toTinybars().toString(), 8).toString()
        : '0',
      decimals: caipNetwork.nativeCurrency.decimals,
      symbol: caipNetwork.nativeCurrency.symbol,
    })
  }

  public override async signMessage(
    params: AdapterBlueprint.SignMessageParams,
  ): Promise<AdapterBlueprint.SignMessageResult> {
    const { provider, message, address } = params

    if (this.activeInjectedProvider) {
      const hexMessage = isHexString(message) ? message : hexlify(toUtf8Bytes(message))
      const signature = (await this.activeInjectedProvider.request({
        method: 'personal_sign',
        params: [hexMessage, address],
      })) as string

      return { signature }
    }

    if (!provider) {
      throw new Error('Provider is undefined')
    }
    const hederaProvider = provider as unknown as HederaProvider

    let signature = ''

    if (this.namespace === hederaNamespace) {
      const response = await hederaProvider.hedera_signMessage({
        signerAccountId: address,
        message,
      })

      signature = response.signatureMap
    } else {
      signature = await hederaProvider.eth_signMessage(message, address)
    }

    return { signature }
  }

  public override async estimateGas(
    params: AdapterBlueprint.EstimateGasTransactionArgs,
  ): Promise<AdapterBlueprint.EstimateGasTransactionResult> {
    const { caipNetwork, address } = params
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }

    if (this.activeInjectedProvider) {
      const browserProvider = new BrowserProvider(
        this.activeInjectedProvider as any,
        Number(caipNetwork?.id),
      )
      const signer = new JsonRpcSigner(browserProvider, address as string)
      const gas = await signer.estimateGas({
        from: address,
        to: params.to,
        data: params.data,
        type: 0,
      })
      return { gas }
    }

    const { provider } = params
    if (!provider) {
      throw new Error('Provider is undefined')
    }
    const hederaProvider = provider as unknown as HederaProvider

    const result = await hederaProvider.eth_estimateGas(
      {
        data: params.data as `0x${string}`,
        to: params.to as `0x${string}`,
        address: address as `0x${string}`,
      },
      address as `0x${string}`,
      Number(caipNetwork?.id),
    )

    return { gas: result }
  }

  public async sendTransaction(
    params: AdapterSendTransactionParams,
  ): Promise<AdapterBlueprint.SendTransactionResult> {
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }

    if (this.activeInjectedProvider) {
      const browserProvider = new BrowserProvider(
        this.activeInjectedProvider as any,
        Number(params.caipNetwork?.id),
      )
      const signer = new JsonRpcSigner(browserProvider, params.address)
      const txResponse = await signer.sendTransaction({
        to: params.to,
        value: params.value as bigint,
        data: params.data as string,
        gasLimit: params.gas as bigint,
        gasPrice: params.gasPrice as bigint,
        type: 0,
      })
      const txReceipt = await txResponse.wait()
      return { hash: (txReceipt?.hash as `0x${string}`) || null }
    }

    if (!params.provider) {
      throw new Error('Provider is undefined')
    }
    const hederaProvider = params.provider as unknown as HederaProvider

    const tx = await hederaProvider.eth_sendTransaction(
      {
        value: params.value as bigint,
        to: params.to as `0x${string}`,
        data: params.data as `0x${string}`,
        gas: params.gas as bigint,
        gasPrice: params.gasPrice as bigint,
        address: params.address as `0x${string}`,
      },
      params.address as `0x${string}`,
      Number(params.caipNetwork?.id),
    )

    return { hash: tx }
  }

  public async writeContract(
    params: AdapterBlueprint.WriteContractParams,
  ): Promise<AdapterBlueprint.WriteContractResult> {
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }
    const { caipNetwork, caipAddress, abi, tokenAddress, method, args } = params

    let browserProvider: BrowserProvider
    if (this.activeInjectedProvider) {
      browserProvider = new BrowserProvider(
        this.activeInjectedProvider as any,
        Number(caipNetwork?.id),
      )
    } else {
      if (!params.provider) {
        throw new Error('Provider is undefined')
      }
      browserProvider = new BrowserProvider(params.provider, Number(caipNetwork?.id))
    }

    const signer = new JsonRpcSigner(browserProvider, caipAddress)
    const contract = new Contract(tokenAddress, abi, signer)

    if (!contract || !method) {
      throw new Error('Contract method is undefined')
    }
    const contractMethod = contract[method]
    if (contractMethod) {
      const result = await contractMethod(...args)
      return { hash: result }
    } else throw new Error('Contract method is undefined')
  }

  public async getEnsAddress(params: GetEnsAddressParams): Promise<GetEnsAddressResult> {
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }
    const { name, caipNetwork } = params
    if (caipNetwork) {
      if (isReownName(name)) {
        return {
          address: (await WcHelpersUtil.resolveReownName(name)) || false,
        }
      }
    }

    return { address: false }
  }

  public parseUnits(
    params: AdapterBlueprint.ParseUnitsParams,
  ): AdapterBlueprint.ParseUnitsResult {
    return parseUnits(params.value, params.decimals)
  }

  public formatUnits(
    params: AdapterBlueprint.FormatUnitsParams,
  ): AdapterBlueprint.FormatUnitsResult {
    return formatUnits(params.value, params.decimals)
  }

  public async getCapabilities(
    params: AdapterBlueprint.GetCapabilitiesParams,
  ): Promise<unknown> {
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }

    const provider = this.provider as UniversalProvider

    if (!provider) {
      throw new Error('Provider is undefined')
    }

    const walletCapabilitiesString = provider.session?.sessionProperties?.['capabilities']
    if (walletCapabilitiesString) {
      try {
        const walletCapabilities = JSON.parse(walletCapabilitiesString)
        const accountCapabilities = walletCapabilities[params]
        if (accountCapabilities) {
          return accountCapabilities
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        throw new Error('Error parsing wallet capabilities')
      }
    }
    return await provider.request({
      method: 'wallet_getCapabilities',
      params: [params],
    })
  }

  public async getProfile(): Promise<GetProfileResult> {
    return Promise.resolve({ profileImage: '', profileName: '' })
  }

  public async grantPermissions(): Promise<unknown> {
    return Promise.resolve({})
  }

  public async revokePermissions(): Promise<`0x${string}`> {
    return Promise.resolve('0x')
  }

  public async syncConnection(params: AdapterBlueprint.SyncConnectionParams) {
    const wasDisconnected =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(HederaAdapter.INJECTED_DISCONNECT_KEY) === 'true'

    const injectedProvider =
      !wasDisconnected && (this.activeInjectedProvider || this.injectedProviders.get(params.id))

    if (injectedProvider) {
      // eth_accounts (not eth_requestAccounts) to avoid triggering a popup
      const accounts = (await injectedProvider.request({
        method: 'eth_accounts',
      })) as string[]

      if (accounts && accounts.length > 0) {
        const chainIdHex = (await injectedProvider.request({
          method: 'eth_chainId',
        })) as string
        const chainId = parseInt(chainIdHex, 16)

        this.activeInjectedProvider = injectedProvider
        this.setupInjectedListeners(injectedProvider, params.id)

        return {
          id: params.id,
          type: 'ANNOUNCED' as any,
          provider: injectedProvider as any,
          address: accounts[0],
          chainId,
        }
      }
    }

    return {
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: params.chainId!,
      provider: this.provider as UniversalProvider,
      address: '',
    }
  }

  public override async switchNetwork(params: AdapterBlueprint.SwitchNetworkParams) {
    const { caipNetwork } = params

    if (this.activeInjectedProvider) {
      const chainIdHex = `0x${Number(caipNetwork.id).toString(16)}`
      await this.activeInjectedProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return
    }

    const connector = this.getWalletConnectConnector()
    connector.provider.setDefaultChain(caipNetwork.caipNetworkId)
  }

  protected override getWalletConnectConnector(): ReturnType<
    AdapterBlueprint['getWalletConnectConnector']
  > {
    const connector = this.connectors.find((c) => c.type == 'WALLET_CONNECT')

    if (!connector) {
      throw new Error('WalletConnectConnector not found')
    }

    return connector as any
  }

  public getWalletConnectProvider(): UniversalProvider {
    const connector = this.connectors.find((c) => c.type === 'WALLET_CONNECT')

    const provider = connector?.provider as UniversalProvider

    return provider
  }

  public override async walletGetAssets(
    _params: AdapterBlueprint.WalletGetAssetsParams,
  ): Promise<AdapterBlueprint.WalletGetAssetsResponse> {
    return Promise.resolve({})
  }
}

export namespace HederaAdapter {
  export type Params = AdapterBlueprint.Params & {
    namespaceMode?: 'optional' | 'required'
  }
}
