import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export function usePasskey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executePasskeyFlow = async (
    type: 'login' | 'register',
    generateEndpoint: string,
    verifyEndpoint: string,
    dict: any,
    onSuccess: () => void
  ) => {
    setError('');
    setLoading(true);

    try {
      const optionsRes = await fetch(generateEndpoint);
      const optionsData = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error((dict.apiErrors?.[optionsData.error] || optionsData.error) || dict.auth.passkeyError);
      }

      const { challengeId, ...options } = optionsData;

      let authResponse;
      try {
        if (type === 'login') {
          authResponse = await startAuthentication(options);
        } else {
          authResponse = await startRegistration(options);
        }
      } catch (err) {
        const errorObj = err as Error;
        const errorMessage = errorObj?.message || '';
        if (errorObj?.name === 'NotAllowedError' || errorMessage.includes('timed out or was not allowed')) {
          setError(dict.auth.passkeyCancelled);
        } else {
          setError(errorMessage || dict.auth.passkeyFailed);
        }
        setLoading(false);
        return;
      }

      const verifyRes = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, challengeId })
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok) {
        onSuccess();
      } else {
        setError((dict.apiErrors?.[verifyData.error] || verifyData.error) || dict.auth.passkeyVerificationFailed);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || dict.auth.passkeyError);
      } else {
        setError(dict.auth.passkeyError);
      }
    } finally {
      setLoading(false);
    }
  };

  return { executePasskeyFlow, passkeyLoading: loading, passkeyError: error, setPasskeyError: setError };
}
