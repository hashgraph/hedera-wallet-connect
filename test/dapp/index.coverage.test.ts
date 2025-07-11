import { LedgerId } from '@hashgraph/sdk'
import DAppConnectorDefault, { DAppConnector } from '../../src/lib/dapp'
import { dAppMetadata, projectId } from '../_helpers'
import * as extController from '../../src/lib/shared/extensionController'

jest.mock('../../src/lib/shared/extensionController', () => {
  const actual = jest.requireActual('../../src/lib/shared/extensionController')
  return { ...actual, extensionConnect: jest.fn() }
})

describe('DAppConnector coverage', () => {
  it('default export should equal named export', () => {
    expect(DAppConnectorDefault).toBe(DAppConnector)
  })

  it('connectExtension triggers extensionConnect callback', async () => {
    const connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId, undefined, undefined, undefined, 'off')
    const extensionId = 'ext'
    connector.extensions = [{ id: extensionId, available: true, availableInIframe: false, name: 'Ext' }]

    const extSpy = jest.spyOn(extController, 'extensionConnect').mockImplementation(() => {})
    const connectMock = jest
      .spyOn(connector, 'connect')
      .mockImplementation(async (launchCb: (uri: string) => void) => {
        launchCb('wc:test')
        return {} as any
      })

    await connector.connectExtension(extensionId)

    expect(connectMock).toHaveBeenCalled()
    expect(extSpy).toHaveBeenCalledWith(extensionId, false, 'wc:test')
  })
})
