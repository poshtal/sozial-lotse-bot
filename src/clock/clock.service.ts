import { Injectable } from '@nestjs/common';

/**
 * Единственное место, где программа узнаёт текущее время.
 * В тестах подменяется, чтобы результат не зависел от даты запуска.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
