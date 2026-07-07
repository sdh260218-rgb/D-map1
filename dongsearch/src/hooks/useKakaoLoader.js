import { useEffect, useState } from 'react';

// M-01 예외 3: 지도 타일/SDK 로딩 실패 처리
export function useKakaoLoader() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!window.kakao || !window.kakao.maps) {
      setError(true);
      return;
    }

    try {
      window.kakao.maps.load(() => {
        if (!cancelled) setReady(true);
      });
    } catch (e) {
      if (!cancelled) setError(true);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}
