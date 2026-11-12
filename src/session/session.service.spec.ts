import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock/clock.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let now: number;
  let service: SessionService;

  beforeEach(() => {
    now = Date.UTC(2026, 10, 12, 10, 0, 0);
    const clock = { now: (): Date => new Date(now) } as ClockService;
    const config = { get: (): undefined => undefined } as unknown as ConfigService;
    service = new SessionService(config, clock);
  });

  const minutes = (n: number): number => n * 60 * 1000;

  it('помнит разговор, пока не прошёл час', () => {
    service.start('chat-1', 'status');
    now += minutes(59);

    expect(service.get('chat-1')?.nodeId).toBe('status');
  });

  it('после часа тишины забывает разговор', () => {
    service.start('chat-1', 'status');
    now += minutes(60);

    expect(service.get('chat-1')).toBeUndefined();
  });

  it('новое сообщение продлевает срок', () => {
    const session = service.start('chat-1', 'status');
    now += minutes(50);
    service.touch(session);
    now += minutes(50);

    expect(service.get('chat-1')).toBeDefined();
  });

  it('forget стирает разговор сразу и не трогает чужие', () => {
    service.start('chat-1', 'status');
    service.start('chat-2', 'status');
    service.forget('chat-1');

    expect(service.get('chat-1')).toBeUndefined();
    expect(service.get('chat-2')).toBeDefined();
  });

  it('removeExpired чистит только устаревшие разговоры', () => {
    service.start('old', 'status');
    now += minutes(61);
    service.start('fresh', 'status');
    service.removeExpired();

    expect(service.get('old')).toBeUndefined();
    expect(service.get('fresh')).toBeDefined();
  });
});
