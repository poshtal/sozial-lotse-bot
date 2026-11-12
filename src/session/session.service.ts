import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock/clock.service';
import { Session } from './session';

/**
 * Хранит разговоры в оперативной памяти.
 * Ни базы, ни файлов: после перезапуска или часа тишины ответов нет нигде.
 */
@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly sessions: Map<string, Session> = new Map<string, Session>();
  private readonly ttlMs: number;
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly clock: ClockService,
  ) {
    const ttlMinutes: number = Number(
      this.configService.get<string>('SESSION_TTL_MINUTES') ?? 60,
    );

    if (!(ttlMinutes > 0)) {
      throw new Error('SESSION_TTL_MINUTES should be greater than zero');
    }

    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  onModuleInit(): void {
    // Раз в минуту стираем разговоры, в которых была тишина дольше срока.
    this.sweepTimer = setInterval((): void => this.removeExpired(), 60 * 1000);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  /** Возвращает разговор, если он есть и не устарел. */
  get(chatId: string): Session | undefined {
    const session: Session | undefined = this.sessions.get(chatId);

    if (!session) {
      return undefined;
    }

    if (this.isExpired(session)) {
      this.sessions.delete(chatId);
      return undefined;
    }

    return session;
  }

  start(chatId: string, nodeId: string): Session {
    const session: Session = new Session();
    session.nodeId = nodeId;
    session.lastActivity = this.clock.now().getTime();
    this.sessions.set(chatId, session);
    return session;
  }

  touch(session: Session): void {
    session.lastActivity = this.clock.now().getTime();
  }

  /** Кнопка «Забудь всё» и конец разговора. */
  forget(chatId: string): void {
    this.sessions.delete(chatId);
  }

  removeExpired(): void {
    for (const [chatId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.sessions.delete(chatId);
      }
    }
  }

  private isExpired(session: Session): boolean {
    return this.clock.now().getTime() - session.lastActivity >= this.ttlMs;
  }
}
