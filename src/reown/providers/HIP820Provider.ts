import { EventEmitter } from 'events'
import { CAIPChainIdToLedgerId, DAppSigner } from '../..'
import { SessionNamespace, RequestParams, IProvider } from '@walletconnect/universal-provider'
import { SessionTypes } from '@walletconnect/types'
import { AccountId, Transaction } from '@hashgraph/sdk'

class HIP820Provider implements IProvider {
  events: EventEmitter
  client: IProvider['client']
  namespace: SessionNamespace
  chainId: string

  constructor(opts: {
    namespace: SessionNamespace
    client: IProvider['client']
    events: EventEmitter
  }) {
    this.namespace = opts.namespace
    this.chainId = this.getDefaultChain()

    this.events = opts.events
    this.client = opts.client
  }

  get httpProviders() {
    return {}
  }
  updateNamespace(namespace: SessionTypes.Namespace) {
    this.namespace = Object.assign(this.namespace, namespace)
  }
  request<T = unknown>(args: RequestParams): Promise<T> {
    return this.getSigner(args.topic).request<T>({
      method: args.request.method,
      params: args.request.params,
    })
  }

  async signTransaction<T extends Transaction>(transaction: T, topic: string): Promise<T> {
    return this.getSigner(topic).signTransaction(transaction)
  }

  requestAccounts(): string[] {
    const accounts = this.namespace.accounts
    if (!accounts) {
      return []
    }

    return Array.from(
      new Set(
        accounts
          // get the accounts from the active chain
          .filter((account) => account.split(':')[1] === this.chainId.toString())
          // remove namespace & chainId from the string
          .map((account) => account.split(':')[2]),
      ),
    )
  }

  setDefaultChain(chainId: string): void {
    this.chainId = chainId
    this.namespace.defaultChain = chainId
  }

  getDefaultChain(): string {
    if (this.chainId) return this.chainId
    if (this.namespace.defaultChain) return this.namespace.defaultChain

    const chainId = this.namespace.chains[0]
    if (!chainId) throw new Error(`ChainId not found`)

    return chainId.split(':')[1]
  }

  // create signer on demand
  getSigner(topic: string) {
    return this.getSigners(topic)[0]
  }

  getSigners(topic: string) {
    const accounts = this.namespace.accounts?.map((account) => {
      const [chain, network, acc] = account.split(':')
      return {
        ledgerId: CAIPChainIdToLedgerId(`${chain}:${network}`),
        accountId: AccountId.fromString(acc),
      }
    })

    if (!accounts) {
      throw new Error('Accounts not found')
    }

    return accounts.map(
      ({ accountId, ledgerId }) => new DAppSigner(accountId, this.client, topic, ledgerId),
    )
  }
}

export default HIP820Provider
