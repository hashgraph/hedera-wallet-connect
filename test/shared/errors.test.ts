import { HEDERA_ERRORS, getHederaError } from '../../src/lib/shared/errors'

describe('getHederaError', () => {
  it('returns error with context and data', () => {
    const result = getHederaError('INVALID_PARAMS', 'in transfer', 123)
    expect(result).toEqual({
      code: HEDERA_ERRORS.INVALID_PARAMS.code,
      message: 'INVALID_PARAMS in transfer',
      data: 123,
    })
  })

  it('returns error without context', () => {
    const result = getHederaError('INVALID_PARAMS')
    expect(result).toEqual({
      code: HEDERA_ERRORS.INVALID_PARAMS.code,
      message: HEDERA_ERRORS.INVALID_PARAMS.message,
      data: undefined,
    })
  })
})
