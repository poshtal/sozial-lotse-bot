import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QuestionNode, QuestionTree } from './types/question-node';

@Injectable()
export class QuestionnaireService {
  private readonly tree: QuestionTree;

  constructor(private readonly configService: ConfigService) {
    const dataDir: string =
      this.configService.get<string>('DATA_DIR') ??
      join(process.cwd(), 'data');

    this.tree = JSON.parse(
      readFileSync(join(dataDir, 'questionnaire.json'), 'utf-8'),
    ) as QuestionTree;

    this.validateTree();
  }

  getStartId(): string {
    return this.tree.start;
  }

  getNode(id: string): QuestionNode {
    const node: QuestionNode | undefined = this.tree.nodes[id];

    if (!node) {
      throw new Error(`Questionnaire node "${id}" does not exist`);
    }

    return node;
  }

  /**
   * Проверяет дерево при запуске: все ссылки должны вести на существующие
   * узлы. Опечатка в файле ломает запуск, а не разговор с человеком.
   */
  private validateTree(): void {
    this.getNode(this.tree.start);

    for (const [id, node] of Object.entries(this.tree.nodes)) {
      const nextIds: string[] =
        node.type === 'choice'
          ? node.options.map((o) => o.next)
          : node.type === 'end'
            ? []
            : [node.next];

      if (node.type === 'choice' && node.options.length === 0) {
        throw new Error(`Questionnaire node "${id}" has no options`);
      }

      for (const nextId of nextIds) {
        if (!this.tree.nodes[nextId]) {
          throw new Error(
            `Questionnaire node "${id}" points to missing node "${nextId}"`,
          );
        }
      }
    }
  }
}
