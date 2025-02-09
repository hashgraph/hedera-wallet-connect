import Client from '@walletconnect/sign-client'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'
import { EngineTypes, SessionTypes } from '@walletconnect/types'

import { getChainId, hederaMainnetEvm, hederaTestnetEvm } from '../utils'
import { EventEmitter } from 'events'
import {
  IProvider,
  SessionNamespace,
  RpcProvidersMap,
  RequestParams,
  Namespace,
} from '@walletconnect/universal-provider'

class EIP155Provider implements IProvider {
  public name = 'eip155'
  public client: Client
  // the active chainId on the dapp
  public chainId: number
  public namespace: SessionNamespace
  public httpProviders: RpcProvidersMap
  public events: EventEmitter

  constructor({
    client,
    events,
    namespace,
  }: {
    client: IProvider['client']
    events: EventEmitter
    namespace: Namespace
  }) {
    this.namespace = namespace
    this.events = events
    this.client = client
    this.httpProviders = this.createHttpProviders()
    this.chainId = parseInt(this.getDefaultChain())
  }

  public async request<T = unknown>(args: RequestParams): Promise<T> {
    switch (args.request.method) {
      case 'eth_requestAccounts':
        return this.getAccounts() as unknown as T
      case 'eth_accounts':
        return this.getAccounts() as unknown as T
      case 'eth_chainId':
        return parseInt(this.getDefaultChain()) as unknown as T
      default:
        break
    }
    if (this.namespace.methods.includes(args.request.method)) {
      return await this.client.request(args as EngineTypes.RequestParams)
    }
    return this.getHttpProvider().request(args.request)
  }

  public updateNamespace(namespace: SessionTypes.Namespace) {
    this.namespace = Object.assign(this.namespace, namespace)
  }

  public setDefaultChain(chainId: string, rpcUrl?: string | undefined) {
    // http provider exists so just set the chainId
    if (!this.httpProviders[chainId]) {
      this.setHttpProvider(parseInt(chainId), rpcUrl)
    }
    this.chainId = parseInt(chainId)
    this.events.emit('default_chain_changed', `${this.name}:${chainId}`)
  }

  public requestAccounts(): string[] {
    return this.getAccounts()
  }

  public getDefaultChain(): string {
    if (this.chainId) return this.chainId.toString()
    if (this.namespace.defaultChain) return this.namespace.defaultChain

    const chainId = this.namespace.chains[0]
    if (!chainId) throw new Error(`ChainId not found`)

    return chainId.split(':')[1]
  }

  // ---------- Private ----------------------------------------------- //

  private createHttpProvider(
    chainId: number,
    rpcUrl?: string | undefined,
  ): JsonRpcProvider | undefined {
    if (!chainId) return undefined
    const caipNetwork = [hederaMainnetEvm, hederaTestnetEvm].find(
      (network) => network.id == chainId,
    )
    const rpc = caipNetwork?.rpcUrls.default.http[0] || rpcUrl
    if (!rpc) {
      throw new Error(`No RPC url provided for chainId: ${chainId}`)
    }
    const http = new JsonRpcProvider(new HttpConnection(rpc, false))
    return http
  }

  private setHttpProvider(chainId: number, rpcUrl?: string): void {
    const http = this.createHttpProvider(chainId, rpcUrl)
    if (http) {
      this.httpProviders[chainId] = http
    }
  }

  private createHttpProviders(): RpcProvidersMap {
    const http: Record<number, JsonRpcProvider> = {}
    this.namespace.chains.forEach((chain) => {
      const parsedChain = parseInt(getChainId(chain))
      http[parsedChain] = this.createHttpProvider(parsedChain, this.namespace.rpcMap?.[chain])!
    })
    return http
  }

  private getAccounts(): string[] {
    const accounts = this.namespace.accounts
    if (!accounts) {
      return []
    }
    return Array.from(
      new Set(
        accounts
          .filter((account) => account.split(':')[1] === this.chainId.toString())
          .map((account) => account.split(':')[2]),
      ),
    )
  }

  private getHttpProvider(): JsonRpcProvider {
    const chain = this.chainId
    const http = this.httpProviders[chain]
    if (typeof http === 'undefined') {
      throw new Error(`JSON-RPC provider for ${chain} not found`)
    }
    return http
  }
}

export default EIP155Provider
