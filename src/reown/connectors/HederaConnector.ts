import type { SessionTypes } from '@walletconnect/types'
import { CaipNetwork, ChainNamespace, ConstantsUtil } from '@reown/appkit-common'
import { AdapterBlueprint, type ChainAdapterConnector } from '@reown/appkit/adapters'
import { PresetsUtil } from '@reown/appkit-utils'
import { createNamespaces } from '../utils'
import { createLogger } from '../../lib/shared/logger'

type UniversalProvider = Parameters<AdapterBlueprint['setUniversalProvider']>[0]

export class HederaConnector implements ChainAdapterConnector {
  public readonly id = ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT
  public readonly name = PresetsUtil.ConnectorNamesMap[
    ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT
  ] as string
  public readonly type = 'WALLET_CONNECT'
  public readonly imageId =
    PresetsUtil.ConnectorImageIds[ConstantsUtil.CONNECTOR_ID.WALLET_CONNECT]
  public readonly chain: ChainNamespace
  public provider: UniversalProvider

  protected caipNetworks: CaipNetwork[]
  private logger = createLogger('HederaConnector')

  constructor({ provider, caipNetworks, namespace }: HederaConnector.Options) {
    this.caipNetworks = caipNetworks
    this.provider = provider
    this.chain = namespace as ChainNamespace
  }

  get chains() {
    return this.caipNetworks
  }

  async connectWalletConnect() {
    this.logger.debug('connectWalletConnect called for', this.chain)
    this.logger.debug('Provider type:', this.provider?.constructor?.name)
    this.logger.debug('Provider session exists:', !!this.provider?.session)

    const isAuthenticated = await this.authenticate()
    this.logger.debug('Is authenticated:', isAuthenticated)

    if (!isAuthenticated) {
      // Check for stored connection params from the dApp
      let connectParams: any = undefined

      this.logger.debug('Checking for stored params')
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const storedParams = sessionStorage.getItem('hwcV2ConnectionParams')
        this.logger.debug('Stored params in sessionStorage:', storedParams)
        if (storedParams) {
          try {
            connectParams = JSON.parse(storedParams)
            this.logger.info(
              'Using stored connection params from dApp in connector:',
              connectParams,
            )
            // Don't clear here - let the provider handle it
          } catch (e) {
            this.logger.warn('Failed to parse stored connection params in connector:', e)
          }
        }
      }

      // If no stored params, create default namespaces
      if (!connectParams) {
        const namespaces = createNamespaces(this.caipNetworks)
        connectParams = { optionalNamespaces: namespaces }
        this.logger.debug('No stored params, using default namespaces:', connectParams)
      }

      this.logger.debug('Connecting with params:', {
        namespace: this.chain,
        caipNetworks: this.caipNetworks.map((n) => ({
          id: n.id,
          chainNamespace: n.chainNamespace,
          caipNetworkId: n.caipNetworkId,
          name: n.name,
        })),
        connectParams,
      })

      this.logger.debug('Final params before provider.connect:', connectParams)
      this.logger.debug('Calling provider.connect with params')
      await this.provider.connect(connectParams)
      this.logger.info('Provider.connect completed successfully')
    } else {
      this.logger.info('Already authenticated, skipping namespace setup')
    }

    return {
      clientId: await this.provider.client.core.crypto.getClientId(),
      session: this.provider.session as SessionTypes.Struct,
    }
  }

  async disconnect() {
    await this.provider.disconnect()
  }

  async authenticate(): Promise<boolean> {
    return false
  }
}

export namespace HederaConnector {
  export type Options = {
    provider: UniversalProvider
    caipNetworks: CaipNetwork[]
    namespace: 'hedera' | 'eip155'
  }
}
