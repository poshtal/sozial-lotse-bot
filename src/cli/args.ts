/** Разбирает аргументы вида: --file путь --paragraphs 136-164 --raw остальной текст */
export class CliArgs {
  options: Record<string, string> = {};
  /** Флаги без значения: --raw */
  flags: string[] = [];
  rest: string[] = [];
}

/** Флаги, у которых нет значения после них. */
const FLAGS: string[] = ['raw'];

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = new CliArgs();

  for (let i: number = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && FLAGS.includes(argv[i].slice(2))) {
      args.flags.push(argv[i].slice(2));
    } else if (argv[i].startsWith('--')) {
      args.options[argv[i].slice(2)] = argv[i + 1] ?? '';
      i++;
    } else {
      args.rest.push(argv[i]);
    }
  }

  return args;
}
