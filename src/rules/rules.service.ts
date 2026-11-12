import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { checkAnwartschaft } from './anwartschaft.rule';
import { AnwartschaftParams } from './types/anwartschaft-params';
import { AnwartschaftResult } from './types/anwartschaft-result';
import { EmploymentPeriod } from './types/employment-period';

@Injectable()
export class RulesService {
  private readonly anwartschaftParams: AnwartschaftParams;

  constructor(private readonly configService: ConfigService) {
    const dataDir: string =
      this.configService.get<string>('DATA_DIR') ??
      join(process.cwd(), 'data');

    const rules = JSON.parse(
      readFileSync(join(dataDir, 'rules.json'), 'utf-8'),
    ) as { anwartschaftszeit: AnwartschaftParams };

    this.anwartschaftParams = rules.anwartschaftszeit;
  }

  checkAnwartschaft(
    periods: EmploymentPeriod[],
    referenceDate: Date,
  ): AnwartschaftResult {
    return checkAnwartschaft(periods, referenceDate, this.anwartschaftParams);
  }
}
