import { WebSocketGateway } from '@nestjs/websockets';

/**
 * Skeleton only — reserved for future realtime dashboard sync across family
 * members (Section 3, "Realtime (optional, future)"). No event handlers yet.
 */
@WebSocketGateway({ namespace: 'weddings' })
export class WeddingGateway {}
