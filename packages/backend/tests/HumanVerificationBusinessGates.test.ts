import { AuthApplicationService } from '../src/application/identity/AuthApplicationService'
import { CommunityApplicationService } from '../src/application/community/CommunityApplicationService'
import { MessagingApplicationService } from '../src/application/messaging/MessagingApplicationService'
import type { HumanVerificationPurpose } from '../src/domain/shared/ports/IHumanVerification'

/** Focused business-boundary smoke, not provider/Redis/browser acceptance. */
describe.each<HumanVerificationPurpose>(['registration', 'post', 'comment', 'friendRequest'])(
  'human verification business gate: %s',
  (purpose) => {
    function fixture(withProvider = true) {
      const humanVerification = {
        requires: jest.fn().mockResolvedValue(true),
        consumeProof: jest.fn().mockResolvedValue(true),
      }
      // Stop immediately after the gate. Reaching this sentinel proves business continuation.
      const business = jest.fn().mockRejectedValue(new Error('BUSINESS_REACHED'))
      const options: any = {
        ...(withProvider ? { humanVerification } : {}),
        userRepository: { findByEmail: business },
        categoryRepository: { findById: business },
        postRepository: { findById: business },
        identityIntegrationPort: { getUserProfile: business },
      }
      const invoke = (token?: string) => {
        if (purpose === 'registration') {
          return new AuthApplicationService(options).registerUser(
            'user@example.com', 'user', 'StrongPassword1!', token,
          )
        }
        if (purpose === 'post') {
          return new CommunityApplicationService(options).createPost('Title', 'Body', 'cat', 'user', 1, token)
        }
        if (purpose === 'comment') {
          return new CommunityApplicationService(options).createComment({} as any, 'Body', 'post', 'user', token)
        }
        return new MessagingApplicationService(options).sendFriendRequestWithValidation('user', 'friend', token)
      }
      return { humanVerification, business, invoke }
    }

    it('consumes the opaque alias with exactly the gate purpose', async () => {
      const { humanVerification, business, invoke } = fixture()
      await expect(invoke('opaque-proof')).rejects.toThrow('BUSINESS_REACHED')
      expect(humanVerification.requires).toHaveBeenCalledWith(purpose)
      expect(humanVerification.consumeProof).toHaveBeenCalledTimes(1)
      expect(humanVerification.consumeProof).toHaveBeenCalledWith('opaque-proof', purpose)
      expect(business).toHaveBeenCalledTimes(1)
    })

    it('rejects a missing proof without entering business code', async () => {
      const { humanVerification, business, invoke } = fixture()
      await expect(invoke()).rejects.toThrow('ERR_CAPTCHA_IS_REQUIRED')
      expect(humanVerification.consumeProof).not.toHaveBeenCalled()
      expect(business).not.toHaveBeenCalled()
    })

    it('rejects an invalid legacy challenge or replay rejected by the port', async () => {
      const { humanVerification, business, invoke } = fixture()
      humanVerification.consumeProof.mockResolvedValue(false)
      await expect(invoke('old-challenge-id')).rejects.toThrow(/ERR_INVALID.*CAPTCHA/)
      expect(business).not.toHaveBeenCalled()
    })

    it('propagates requires outage even if consumption would succeed', async () => {
      const { humanVerification, business, invoke } = fixture()
      humanVerification.requires.mockRejectedValue(new Error('PROVIDER_UNAVAILABLE'))
      await expect(invoke('opaque-proof')).rejects.toThrow('PROVIDER_UNAVAILABLE')
      expect(humanVerification.consumeProof).not.toHaveBeenCalled()
      expect(business).not.toHaveBeenCalled()
    })

    it('propagates consumption outage without entering business code', async () => {
      const { humanVerification, business, invoke } = fixture()
      humanVerification.consumeProof.mockRejectedValue(new Error('STORE_UNAVAILABLE'))
      await expect(invoke('opaque-proof')).rejects.toThrow('STORE_UNAVAILABLE')
      expect(business).not.toHaveBeenCalled()
    })

    it('fails closed when the provider port is missing', async () => {
      const { business, invoke } = fixture(false)
      await expect(invoke('opaque-proof')).rejects.toThrow()
      expect(business).not.toHaveBeenCalled()
    })

    it('bypasses proof consumption only for an explicitly disabled surface', async () => {
      const { humanVerification, business, invoke } = fixture()
      humanVerification.requires.mockResolvedValue(false)
      await expect(invoke()).rejects.toThrow('BUSINESS_REACHED')
      expect(humanVerification.requires).toHaveBeenCalledWith(purpose)
      expect(humanVerification.consumeProof).not.toHaveBeenCalled()
      expect(business).toHaveBeenCalledTimes(1)
    })
  },
)
