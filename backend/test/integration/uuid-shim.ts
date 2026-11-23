// The uuid package ships ESM only; integration tests load services that import it.
import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();
