import type { SessionTypes } from '@walletconnect/types'
import { ChainNamespace } from '@reown/appkit-common'
import { createNamespaces } from '../utils'
import { WalletConnectConnector } from '@reown/appkit/connectors'

export class HederaWalletConnectConnector extends WalletConnectConnector<ChainNamespace> {
  async connectWalletConnect() {
    const isAuthenticated = await this.authenticate()

    if (!isAuthenticated) {
      await this.provider.connect({
        optionalNamespaces: createNamespaces(this.caipNetworks),
      })
    }

    return {
      clientId: await this.provider.client.core.crypto.getClientId(),
      session: this.provider.session as SessionTypes.Struct,
    }
  }
}
