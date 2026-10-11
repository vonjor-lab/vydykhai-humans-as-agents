// Shared parsing of the framework's existing Markdown artifacts, not a new format.
export function section(content, heading, nextHeadings) {
  const start = content.indexOf(heading);
  if (start === -1) return "";
  const candidates = nextHeadings.map(next => content.indexOf(next, start + heading.length)).filter(index => index !== -1);
  return content.slice(start + heading.length, candidates.length ? Math.min(...candidates) : content.length);
}

export function tableRows(value, headerPattern) {
  return value.split("\n").filter(line => /^\|/.test(line))
    .map(line => {
      const cells = []; let cell = "", slashes = 0;
      for (const char of line) {
        if (char === "|" && slashes % 2 === 0) {cells.push(cell.trim()); cell = "";}
        else if (char === "|" && slashes % 2) cell = cell.slice(0, -1) + "|";
        else cell += char;
        slashes = char === "\\" ? slashes + 1 : 0;
      }
      return cells.slice(1);
    })
    .filter(cells => cells.length && !cells.every(cell => /^[-: ]+$/.test(cell)))
    .filter(cells => !headerPattern.test(cells[0] || ""))
    .filter(cells => !cells.every(cell => /^<.*>$/.test(cell)));
}

export function bulletFields(lines) {
  const fields = new Map(), duplicates = []; let previous = null;
  for (const line of lines) {
    const plain = line.replace(/^- \*\*([^*:\r\n]+):\*\*/, "- $1:").replace(/^- \*\*([^*:\r\n]+)\*\*:/, "- $1:");
    const field = plain.match(/^- ([^:]+):[ \t]*(.*)$/);
    if (!field) {
      if (previous && /^\s{2,}\S/.test(line)) fields.set(previous, fields.get(previous) + "\n" + line.trim());
      else previous = null;
      continue;
    }
    const key = field[1].trim();
    if (fields.has(key)) duplicates.push(key);
    fields.set(key, field[2].trim().replace(/^`|`$/g, ""));
    previous = key;
  }
  return {fields, duplicates};
}
