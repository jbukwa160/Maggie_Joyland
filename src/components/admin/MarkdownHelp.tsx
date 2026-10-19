import { Kbd } from "./ui";

/** Short cheat-sheet for the simple markdown used in descriptions and info pages. */
export function MarkdownHelp({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <span>
        Форматиране: <Kbd>**удебелен**</Kbd> <Kbd>## Заглавие</Kbd> <Kbd>- списък</Kbd> <Kbd>[текст](https://…)</Kbd>. Празен ред = нов абзац.
      </span>
    );
  }
  const rows: [string, string][] = [
    ["## Заглавие", "Голямо заглавие на раздел"],
    ["### Подзаглавие", "По-малко заглавие"],
    ["**удебелен текст**", "Удебелен текст"],
    ["*наклонен текст*", "Наклонен текст"],
    ["- първо\n- второ", "Списък с точки"],
    ["1. първо\n2. второ", "Номериран списък"],
    ["[Доставка](/page/dostavka)", "Връзка към страница"],
    ["(празен ред)", "Нов абзац"],
  ];
  return (
    <div className="rounded-2xl border border-secondary-200 bg-secondary-50 p-4">
      <p className="mb-2 text-sm font-extrabold text-ink">Как се форматира текстът</p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([code, result]) => (
            <tr key={code} className="border-t border-secondary-100 first:border-0">
              <td className="py-1.5 pr-3 align-top">
                <code className="font-mono whitespace-pre text-ink">{code}</code>
              </td>
              <td className="py-1.5 align-top text-ink-soft">{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
