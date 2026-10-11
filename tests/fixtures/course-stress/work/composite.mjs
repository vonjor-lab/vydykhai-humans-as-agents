export function buildArchive(items) {
  return items.map((item, index) => ({
    filename: `export-${index}.csv`,
    payload: item.payload,
  }));
}

export function lookup(archive, query) {
  return archive.find(item => item.filename === query.id) ?? null;
}
