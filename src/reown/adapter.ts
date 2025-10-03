import { CoreHelperUtil, WcHelpersUtil, CaipNetwork } from '@reown/appkit'
import { type ChainNamespace, isReownName } from '@reown/appkit-common'
import { AdapterBlueprint } from '@reown/appkit/adapters'
import { LedgerId } from '@hashgraph/sdk'
import { BrowserProvider, Contract, formatUnits, JsonRpcSigner, parseUnits } from 'ethers'

import { HederaProvider } from './providers'
import { HederaConnector } from './connectors'
import { hederaNamespace, getAccountBalance, HederaChainDefinition } from './utils'
import { createLogger } from '../lib/shared/logger'

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
  private logger = createLogger('HederaAdapter')

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

    // Override getCaipNetworks to return appropriate networks based on namespace
    this.getCaipNetworks = (namespace?: ChainNamespace): CaipNetwork[] => {
      const targetNamespace = namespace || this.namespace

      if (targetNamespace === 'eip155') {
        // Return EIP155 Hedera networks
        return [HederaChainDefinition.EVM.Mainnet, HederaChainDefinition.EVM.Testnet]
      } else if (targetNamespace === hederaNamespace) {
        // Return native Hedera networks
        return [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet]
      } else {
        // Return all Hedera networks if no specific namespace is requested
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

    // Get the WalletConnect connector and ensure it connects with proper namespaces
    const connector = this.getWalletConnectConnector()
    if (connector && 'connectWalletConnect' in connector) {
      this.logger.debug('Calling HederaConnector.connectWalletConnect')
      await (connector as any).connectWalletConnect()
    } else {
      this.logger.warn('HederaConnector not found or connectWalletConnect method missing')
    }

    return Promise.resolve({
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: Number(params.chainId),
      provider: this.provider as UniversalProvider,
      address: '',
    })
  }

  public async disconnect(
    _params?: AdapterBlueprint.DisconnectParams,
  ): Promise<AdapterBlueprint.DisconnectResult> {
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
    const provider = this.provider as UniversalProvider
    const addresses = (provider?.session?.namespaces?.[namespace]?.accounts
      ?.map((account) => {
        const [, , address] = account.split(':')
        return address
      })
      .filter((address, index, self) => self.indexOf(address) === index) || []) as string[]

    return Promise.resolve({
      accounts: addresses.map((address) =>
        CoreHelperUtil.createAccount(namespace, address, 'eoa'),
      ),
    })
  }

  public async syncConnectors() {
    return Promise.resolve()
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
    const { provider, caipNetwork, address } = params
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }
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
    if (!params.provider) {
      throw new Error('Provider is undefined')
    }
    const hederaProvider = params.provider as unknown as HederaProvider

    if (this.namespace == 'eip155') {
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
    } else {
      throw new Error('Namespace is not eip155')
    }
  }

  public async writeContract(
    params: AdapterBlueprint.WriteContractParams,
  ): Promise<AdapterBlueprint.WriteContractResult> {
    if (!params.provider) {
      throw new Error('Provider is undefined')
    }
    if (this.namespace !== 'eip155') {
      throw new Error('Namespace is not eip155')
    }
    const { provider, caipNetwork, caipAddress, abi, tokenAddress, method, args } = params

    const browserProvider = new BrowserProvider(provider, Number(caipNetwork?.id))
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

  // Not supported
  public async getProfile(): Promise<GetProfileResult> {
    return Promise.resolve({
      profileImage: '',
      profileName: '',
    })
  }
  // Not supported
  public async grantPermissions(): Promise<unknown> {
    return Promise.resolve({})
  }
  // Not supported
  public async revokePermissions(): Promise<`0x${string}`> {
    return Promise.resolve('0x')
  }

  public async syncConnection(params: AdapterBlueprint.SyncConnectionParams) {
    return Promise.resolve({
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: params.chainId!,
      provider: this.provider as UniversalProvider,
      address: '',
    })
  }

  public override async switchNetwork(params: AdapterBlueprint.SwitchNetworkParams) {
    const { caipNetwork } = params
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
