export class SignerMissingOnModalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignerMissingOnModalError'
  }
}
