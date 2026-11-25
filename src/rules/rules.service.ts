import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { calculateAnspruchsdauer } from './anspruchsdauer.rule';
import { checkAnwartschaft } from './anwartschaft.rule';
import { AnspruchsdauerParams } from './types/anspruchsdauer-params';
import { AnspruchsdauerResult } from './types/anspruchsdauer-result';
import { AnwartschaftParams } from './types/anwartschaft-params';
import { AnwartschaftResult } from './types/anwartschaft-result';
import { EmploymentPeriod } from './types/employment-period';

@Injectable()
export class RulesService {
  private readonly anwartschaftParams: AnwartschaftParams;
  private readonly anspruchsdauerParams: AnspruchsdauerParams;

  constructor(private readonly configService: ConfigService) {
    const dataDir: string =
      this.configService.get<string>('DATA_DIR') ??
      join(process.cwd(), 'data');

    const rules = JSON.parse(
      readFileSync(join(dataDir, 'rules.json'), 'utf-8'),
    ) as {
      anwartschaftszeit: AnwartschaftParams;
      anspruchsdauer: AnspruchsdauerParams;
    };

    this.anwartschaftParams = rules.anwartschaftszeit;
    this.anspruchsdauerParams = rules.anspruchsdauer;
  }

  /** Есть ли такая возрастная группа: проверка дерева вопросов при запуске. */
  hasAgeGroup(groupId: string): boolean {
    return groupId in this.anspruchsdauerParams.ageGroups;
  }

  checkAnwartschaft(
    periods: EmploymentPeriod[],
    referenceDate: Date,
  ): AnwartschaftResult {
    return checkAnwartschaft(periods, referenceDate, this.anwartschaftParams);
  }

  /**
   * @param ageGroup id кнопки возраста из анкеты: "under50", "50to54"...
   */
  calculateAnspruchsdauer(
    periods: EmploymentPeriod[],
    referenceDate: Date,
    ageGroup: string,
  ): AnspruchsdauerResult {
    const minAge: number | undefined = this.anspruchsdauerParams.ageGroups[ageGroup];

    if (minAge === undefined) {
      throw new Error(`Unknown age group "${ageGroup}"`);
    }

    return calculateAnspruchsdauer(
      periods,
      referenceDate,
      minAge,
      this.anspruchsdauerParams,
    );
  }
}
