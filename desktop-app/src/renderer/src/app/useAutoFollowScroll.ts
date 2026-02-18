import { useCallback, useEffect, useRef, useState } from 'react';

const BOTTOM_THRESHOLD_PX = 16;

function isNearBottom(el: HTMLDivElement): boolean {
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distanceFromBottom <= BOTTOM_THRESHOLD_PX;
}

export function useAutoFollowScroll(trigger: unknown) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAttached, setIsAttached] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAttached(isNearBottom(el));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAttached) return;
    el.scrollTop = el.scrollHeight;
  }, [trigger, isAttached]);

  return { scrollRef, handleScroll, isAttached };
}
