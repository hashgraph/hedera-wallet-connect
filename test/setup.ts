// allow create multiple walletconnect core instances
process.env.DISABLE_GLOBAL_CORE = "true";

// mock localStorage for modal-core CoreUtil logic (e.g. removeWalletConnectDeepLink)
globalThis.localStorage = {
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage
