import { useEffect, useState } from 'react';

import { getStatus, subscribe, type QueueStatus } from '@/lib/offline-queue';

export function useQueueStatus(): QueueStatus {
  const [status, setStatus] = useState<QueueStatus>(getStatus);
  useEffect(() => subscribe(setStatus), []);
  return status;
}
