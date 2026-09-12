
export function createGeographyRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toMapLayer } = mappers;
  return {
    async mapLayers() {
      if (!pool) return jsonDb.mapLayers || [];
      const { rows } = await pool.query('select * from map_layers order by created_at desc');
      return rows.map(toMapLayer);
    },
    async createMapLayer(layer) {
      if (!pool) { jsonDb.mapLayers ||= []; jsonDb.mapLayers.unshift(layer); saveJson(); return layer; }
      const { rows } = await pool.query('insert into map_layers (id,name,type,data,url,bounds,opacity,fill_opacity,category,operational_use,color,fill_color,line_weight,line_style,point_icon,point_icon_color,point_size,show_labels,label_field,label_color,popup_fields,visible,z_index,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning *', [layer.id, layer.name, layer.type, layer.data || null, layer.url || null, layer.bounds || null, layer.opacity, layer.fillOpacity ?? 0.18, layer.category, layer.operationalUse || 'Reference', layer.color, layer.fillColor, layer.lineWeight || 2, layer.lineStyle || 'solid', layer.pointIcon || 'pin', layer.pointIconColor || '#ffffff', layer.pointSize ?? 2, layer.showLabels, layer.labelField, layer.labelColor || '#3f0b1b', layer.popupFields || '', layer.visible, layer.zIndex, layer.createdAt]);
      return toMapLayer(rows[0]);
    },
    async updateMapLayer(id, changes) {
      if (!pool) {
        const index = (jsonDb.mapLayers || []).findIndex(layer => layer.id === id);
        if (index < 0) return null;
        jsonDb.mapLayers[index] = { ...jsonDb.mapLayers[index], ...changes, updatedAt: new Date().toISOString() };
        saveJson();
        return jsonDb.mapLayers[index];
      }
      const current = await pool.query('select * from map_layers where id=$1', [id]);
      if (!current.rows[0]) return null;
      const merged = { ...toMapLayer(current.rows[0]), ...changes, updatedAt: new Date().toISOString() };
      const { rows } = await pool.query('update map_layers set name=$2, opacity=$3, fill_opacity=$4, category=$5, operational_use=$6, color=$7, fill_color=$8, line_weight=$9, line_style=$10, point_icon=$11, point_icon_color=$12, point_size=$13, show_labels=$14, label_field=$15, label_color=$16, popup_fields=$17, visible=$18, z_index=$19, updated_at=$20 where id=$1 returning *', [id, merged.name, merged.opacity, merged.fillOpacity, merged.category, merged.operationalUse, merged.color, merged.fillColor, merged.lineWeight, merged.lineStyle, merged.pointIcon, merged.pointIconColor, merged.pointSize, merged.showLabels, merged.labelField, merged.labelColor, merged.popupFields, merged.visible, merged.zIndex, merged.updatedAt]);
      return toMapLayer(rows[0]);
    },
    async deleteMapLayer(id) {
      if (!pool) { jsonDb.mapLayers = (jsonDb.mapLayers || []).filter(layer => layer.id !== id); saveJson(); return; }
      await pool.query('delete from map_layers where id=$1', [id]);
    },
  };
}
