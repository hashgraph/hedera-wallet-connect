import { DefaultLogger } from '../../src/lib/shared/logger'

describe('DefaultLogger', () => {
  let logger: DefaultLogger
  let consoleErrorSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance
  let consoleInfoSpy: jest.SpyInstance
  let consoleDebugSpy: jest.SpyInstance

  beforeEach(() => {
    // Create fresh spies for each test
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation()
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation()
  })

  afterEach(() => {
    // Clean up spies
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleInfoSpy.mockRestore()
    consoleDebugSpy.mockRestore()
  })

  describe('constructor', () => {
    it('should set default log level to info', () => {
      logger = new DefaultLogger()
      logger.error('test')
      logger.warn('test')
      logger.info('test')
      logger.debug('test')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test')
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN - Logger] test')
      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO - Logger] test')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
    })

    it('should respect custom log level', () => {
      logger = new DefaultLogger('debug')
      logger.error('test')
      logger.warn('test')
      logger.info('test')
      logger.debug('test')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test')
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN - Logger] test')
      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO - Logger] test')
      expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG - Logger] test')
    })
  })

  describe('setLogLevel', () => {
    beforeEach(() => {
      logger = new DefaultLogger()
    })

    it('should update log level', () => {
      logger.setLogLevel('error')
      logger.error('test')
      logger.warn('test')
      logger.info('test')
      logger.debug('test')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleInfoSpy).not.toHaveBeenCalled()
      expect(consoleDebugSpy).not.toHaveBeenCalled()
    })
  })

  describe('logging methods', () => {
    describe('error level', () => {
      beforeEach(() => {
        logger = new DefaultLogger('error')
      })

      it('should only log errors', () => {
        logger.error('test error')
        logger.warn('test warn')
        logger.info('test info')
        logger.debug('test debug')

        expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test error')
        expect(consoleWarnSpy).not.toHaveBeenCalled()
        expect(consoleInfoSpy).not.toHaveBeenCalled()
        expect(consoleDebugSpy).not.toHaveBeenCalled()
      })

      it('should handle additional arguments', () => {
        const error = new Error('test')
        logger.error('test error', { details: 'more info' }, error)

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[ERROR - Logger] test error',
          { details: 'more info' },
          error,
        )
      })
    })

    describe('warn level', () => {
      beforeEach(() => {
        logger = new DefaultLogger('warn')
      })

      it('should log errors and warnings', () => {
        logger.error('test error')
        logger.warn('test warn')
        logger.info('test info')
        logger.debug('test debug')

        expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test error')
        expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN - Logger] test warn')
        expect(consoleInfoSpy).not.toHaveBeenCalled()
        expect(consoleDebugSpy).not.toHaveBeenCalled()
      })
    })

    describe('info level', () => {
      beforeEach(() => {
        logger = new DefaultLogger('info')
      })

      it('should log errors, warnings, and info', () => {
        logger.error('test error')
        logger.warn('test warn')
        logger.info('test info')
        logger.debug('test debug')

        expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test error')
        expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN - Logger] test warn')
        expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO - Logger] test info')
        expect(consoleDebugSpy).not.toHaveBeenCalled()
      })
    })

    describe('debug level', () => {
      beforeEach(() => {
        logger = new DefaultLogger('debug')
      })

      it('should log all levels', () => {
        logger.error('test error')
        logger.warn('test warn')
        logger.info('test info')
        logger.debug('test debug')

        expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR - Logger] test error')
        expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN - Logger] test warn')
        expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO - Logger] test info')
        expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG - Logger] test debug')
      })
    })
  })
})
