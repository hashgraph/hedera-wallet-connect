import HIP820WalletDefault, { HIP820Wallet } from '../../../../src/reown/wallets/HIP820Wallet'

describe('HIP820Wallet export default coverage', () => {
  it('default export matches named export', () => {
    // Ensure the default export matches the named export. The previous version
    // of this test modified the coverage report which is no longer necessary.
    expect(HIP820WalletDefault).toBe(HIP820Wallet)
  })
})
