/** Разбирает аргументы вида: --file путь --paragraphs 136-164 остальной текст */
export class CliArgs {
  options: Record<string, string> = {};
  rest: string[] = [];
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = new CliArgs();

  for (let i: number = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args.options[argv[i].slice(2)] = argv[i + 1] ?? '';
      i++;
    } else {
      args.rest.push(argv[i]);
    }
  }

  return args;
}
