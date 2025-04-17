import { CoreHelperUtil, WcHelpersUtil } from '@reown/appkit'
import { type ChainNamespace, isReownName } from '@reown/appkit-common'
import { AdapterBlueprint } from '@reown/appkit/adapters'
import { ProviderUtil } from '@reown/appkit/store'
import { LedgerId } from '@hashgraph/sdk'
import { BrowserProvider, Contract, formatUnits, JsonRpcSigner, parseUnits } from 'ethers'

import { HederaProvider } from './providers'
import { HederaConnector } from './connectors'
import { hederaNamespace } from './utils'
import { getAccountInfo } from '..'

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]

export class HederaAdapter extends AdapterBlueprint {
  constructor(params: AdapterBlueprint.Params) {
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
  }

  public override setUniversalProvider(universalProvider: UniversalProvider): void {
    this.addConnector(
      new HederaConnector({
        provider: universalProvider,
        caipNetworks: this.caipNetworks || [],
        namespace: this.namespace as 'hedera' | 'eip155',
      }),
    )
  }

  public async connect(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    return Promise.resolve({
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: Number(params.chainId),
      provider: this.provider as UniversalProvider,
      address: '',
    })
  }

  public async disconnect() {
    try {
      const connector = this.getWalletConnectConnector()
      await connector.disconnect()
    } catch (error) {
      console.warn('UniversalAdapter:disconnect - error', error)
    }
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

    const accountInfo = await getAccountInfo(
      caipNetwork.testnet ? LedgerId.TESTNET : LedgerId.MAINNET,
      address!, // accountId or non-long-zero evmAddress
    )

    return Promise.resolve({
      balance: accountInfo?.balance
        ? formatUnits(accountInfo.balance.balance, 8).toString()
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
    params: AdapterBlueprint.SendTransactionParams,
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
          address: params.address,
        },
        params.address,
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

  public async getEnsAddress(
    params: AdapterBlueprint.GetEnsAddressParams,
  ): Promise<AdapterBlueprint.GetEnsAddressResult> {
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

    const provider = ProviderUtil.getProvider('eip155')

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
  public async getProfile(): Promise<AdapterBlueprint.GetProfileResult> {
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
