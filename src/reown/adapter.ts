import { CoreHelperUtil, CaipNetwork } from '@reown/appkit'
import { type ChainNamespace } from '@reown/appkit-common'
import { AdapterBlueprint } from '@reown/appkit-controllers'
import { LedgerId } from '@hiero-ledger/sdk'
import { HederaProvider } from './providers'
import { HederaConnector } from './connectors'
import { hederaNamespace, getAccountBalance, HederaChainDefinition } from './utils'
import { createLogger } from '../lib/shared/logger'

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]

function formatUnits(value: bigint | string, decimals: number): string {
  const str = value.toString()
  if (decimals === 0) return str
  const padded = str.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, padded.length - decimals)
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '')
  return fracPart ? `${intPart}.${fracPart}` : intPart
}

function parseUnits(value: string, decimals: number): bigint {
  const [intPart, fracPart = ''] = value.split('.')
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(intPart + paddedFrac)
}

export class HederaAdapter extends AdapterBlueprint {
  private logger = createLogger('HederaAdapter')

  constructor(params: HederaAdapter.Params) {
    if (params.namespace !== hederaNamespace) {
      throw new Error('Namespace must be "hedera"')
    }
    if (params.networks?.some((n) => n.chainNamespace != hederaNamespace)) {
      throw new Error('Invalid networks for hedera namespace')
    }
    super({ ...params })

    this.getCaipNetworks = (namespace?: ChainNamespace): CaipNetwork[] => {
      const targetNamespace = namespace || this.namespace

      if (params.networks?.length) {
        return params.networks.filter(
          (n) => !targetNamespace || n.chainNamespace === targetNamespace,
        )
      }

      return [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet]
    }
  }

  public override async setUniversalProvider(
    universalProvider: UniversalProvider,
  ): Promise<void> {
    this.addConnector(
      new HederaConnector({
        provider: universalProvider,
        caipNetworks: this.getCaipNetworks() || [],
        namespace: 'hedera',
      }),
    )
  }

  public async connect(
    params: AdapterBlueprint.ConnectParams,
  ): Promise<AdapterBlueprint.ConnectResult> {
    const connector = this.getWalletConnectConnector()
    if (connector && 'connectWalletConnect' in connector) {
      await (connector as any).connectWalletConnect()
    } else {
      this.logger.warn('HederaConnector not found or connectWalletConnect method missing')
    }

    return {
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: Number(params.chainId),
      provider: this.provider as UniversalProvider,
      address: '',
    }
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

    return {
      accounts: addresses.map((address) =>
        CoreHelperUtil.createAccount(namespace, address, 'eoa'),
      ),
    }
  }

  public async syncConnectors() {
    return
  }

  public async syncConnections(_params: AdapterBlueprint.SyncConnectionsParams): Promise<void> {
    return Promise.resolve()
  }

  public async getBalance(
    params: AdapterBlueprint.GetBalanceParams,
  ): Promise<AdapterBlueprint.GetBalanceResult> {
    const { address, caipNetwork } = params

    if (!caipNetwork) {
      return { balance: '0', symbol: '' }
    }

    const accountBalance = await getAccountBalance(
      caipNetwork.testnet ? LedgerId.TESTNET : LedgerId.MAINNET,
      address!,
    )

    return {
      balance: accountBalance
        ? formatUnits(accountBalance.hbars.toTinybars().toString(), 8)
        : '0',
      symbol: caipNetwork.nativeCurrency.symbol,
    }
  }

  public override async signMessage(
    params: AdapterBlueprint.SignMessageParams,
  ): Promise<AdapterBlueprint.SignMessageResult> {
    const { provider, message, address } = params

    if (!provider) {
      throw new Error('Provider is undefined')
    }

    const hederaProvider = provider as unknown as HederaProvider
    const response = await hederaProvider.hedera_signMessage({
      signerAccountId: address,
      message,
    })

    return { signature: response.signatureMap }
  }

  public override async estimateGas(
    _params: AdapterBlueprint.EstimateGasTransactionArgs,
  ): Promise<AdapterBlueprint.EstimateGasTransactionResult> {
    throw new Error('estimateGas is not supported for the hedera namespace. Use WagmiAdapter for EVM operations.')
  }

  public async sendTransaction(
    _params: AdapterBlueprint.SendTransactionParams & { address: string },
  ): Promise<AdapterBlueprint.SendTransactionResult> {
    throw new Error('sendTransaction is not supported for the hedera namespace. Use WagmiAdapter for EVM operations.')
  }

  public async writeContract(
    _params: AdapterBlueprint.WriteContractParams,
  ): Promise<AdapterBlueprint.WriteContractResult> {
    throw new Error('writeContract is not supported for the hedera namespace. Use WagmiAdapter for EVM operations.')
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
    _params: AdapterBlueprint.GetCapabilitiesParams,
  ): Promise<unknown> {
    throw new Error('getCapabilities is not supported for the hedera namespace. Use WagmiAdapter for EVM operations.')
  }

  public async getProfile(): Promise<{ profileImage: string; profileName: string }> {
    return { profileImage: '', profileName: '' }
  }

  public async grantPermissions(): Promise<unknown> {
    return {}
  }

  public async revokePermissions(): Promise<`0x${string}`> {
    return '0x'
  }

  public async syncConnection(params: AdapterBlueprint.SyncConnectionParams) {
    return {
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT' as const,
      chainId: params.chainId!,
      provider: this.provider as UniversalProvider,
      address: '',
    }
  }

  public override async switchNetwork(params: AdapterBlueprint.SwitchNetworkParams) {
    const connector = this.getWalletConnectConnector()
    connector.provider.setDefaultChain(params.caipNetwork.caipNetworkId)
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
    return connector?.provider as UniversalProvider
  }

  public override async walletGetAssets(
    _params: AdapterBlueprint.WalletGetAssetsParams,
  ): Promise<AdapterBlueprint.WalletGetAssetsResponse> {
    return {}
  }
}

export namespace HederaAdapter {
  export type Params = AdapterBlueprint.Params & {
    namespaceMode?: 'optional' | 'required'
  }
}
