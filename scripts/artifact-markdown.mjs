// Shared parsing of the framework's existing Markdown artifacts, not a new format.
export function section(content, heading, nextHeadings, {stopAtPeerHeading = false} = {}) {
  const start = content.indexOf(heading);
  if (start === -1) return "";
  if (stopAtPeerHeading) {
    const depth = heading.match(/^#{1,6}(?=[ \t]|$)/)?.[0].length;
    const body = content.slice(start + heading.length);
    let offset = 0, fence = null, comment = false;
    for (const rawLine of body.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      } else if (!comment && marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
        fence = marker[1];
      } else {
        const next = !comment && line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)/);
        if (next && next[1].length <= depth) return body.slice(0, offset);
        for (const token of line.matchAll(/<!--|-->/g)) comment = token[0] === "<!--";
      }
      offset += rawLine.length + 1;
    }
    return body;
  }
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
