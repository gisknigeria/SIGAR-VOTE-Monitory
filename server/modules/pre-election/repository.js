const PREFIX = 'pre-election-dataset:';

/**
 * Uploaded pre-election datasets, stored like the other reference datasets (app_settings in
 * Postgres, the JSON file locally). Uploading a contact list or reference table replaces the
 * previous one; member lists replace the previous list with the same label, so "Polling-unit
 * agents" and "BSA-YV volunteers" live side by side.
 */
export function createPreElectionRepository({ pool, jsonDb, saveJson }) {
  const readAll = async () => {
    if (!pool) return Object.values(jsonDb.preElectionDatasets || {});
    return (await pool.query('select value from app_settings where key like $1 order by key', [`${PREFIX}%`])).rows.map((row) => row.value);
  };
  const remove = async (id) => {
    if (!pool) { if (jsonDb.preElectionDatasets) delete jsonDb.preElectionDatasets[id]; return; }
    await pool.query('delete from app_settings where key=$1', [`${PREFIX}${id}`]);
  };
  const replacedBy = (dataset) => (item) => item.kind === dataset.kind && (dataset.kind !== 'members' || item.label.toLowerCase() === dataset.label.toLowerCase());

  return {
    async preElectionDatasets() { return readAll(); },
    async savePreElectionDataset(dataset) {
      const previous = (await readAll()).filter(replacedBy(dataset));
      for (const item of previous) await remove(item.id);
      if (!pool) {
        jsonDb.preElectionDatasets ||= {};
        jsonDb.preElectionDatasets[dataset.id] = dataset;
        saveJson();
      } else {
        await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [`${PREFIX}${dataset.id}`, JSON.stringify(dataset)]);
      }
      return { dataset, replaced: previous.map((item) => item.id) };
    },
    async deletePreElectionDataset(id) {
      const found = (await readAll()).find((item) => item.id === id);
      if (!found) return null;
      await remove(id);
      if (!pool) saveJson();
      return found;
    },
  };
}
