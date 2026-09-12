const preserveUnknownCoordinate = (value) => (value === null || value === undefined ? null : Number(value));

export function createMappers({  }) {
  const toUser = (row) =>
    row && {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role,
      rank: row.rank || "",
      active: row.active,
      unit: row.unit,
      unitType: row.unit_type || "Division",
      command: row.command || "",
      division: row.division || "",
      station: row.station || "",
      state: row.state || "",
      lga: row.lga || "",
      ward: row.ward || "",
      pollingUnit: row.polling_unit || "",
      lat: preserveUnknownCoordinate(row.lat),
      lng: preserveUnknownCoordinate(row.lng),
    };
  const toIncident = (row) =>
    row && {
      id: row.id,
      title: row.title,
      description: row.description,
      reportType: row.report_type || "IP",
      severity: row.severity,
      status: row.status,
      lat: Number(row.lat),
      lng: Number(row.lng),
      assignedTo: row.assigned_to || "",
      visibleTo: row.visible_to || [],
      media: row.media || [],
      geometry: row.geometry || null,
      style: row.style || null,
      lga: row.lga || "",
      ward: row.ward || "",
      pollingUnit: row.polling_unit || "",
      resultCount: row.result_count || "",
      lifecycle: row.lifecycle || {},
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
      captureTime: row.capture_time?.toISOString?.() || row.capture_time || null,
      serverReceiptTime: row.server_receipt_at?.toISOString?.() || row.server_receipt_at || null,
      recordVersion: row.record_version || "1",
      createdBy: row.created_by || "",
      submissionId: row.submission_id || "",
    };
  const toResultRecord = (row) =>
    row && {
      id: row.id,
      submissionId: row.submission_id,
      payloadHash: row.payload_hash,
      electionId: row.election_id,
      scopeId: row.scope_id,
      sourceReleaseId: row.source_release_id || row.provenance?.sourceReleaseId || "",
      resultId: row.result_id || "",
      geography: row.geography || null,
      provenance: row.provenance || null,
      state: row.state || "",
      lga: row.lga || "",
      ward: row.ward || "",
      pollingUnit: row.polling_unit || "",
      resultSource: row.result_source || "",
      submittedBy: row.submitted_by || "",
      submittedByRole: row.submitted_by_role || "",
      resultCount: row.result_count || "",
      evidence: row.evidence || [],
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
      captureTime: row.capture_time?.toISOString?.() || row.capture_time || null,
      serverReceiptTime: row.server_receipt_at?.toISOString?.() || row.server_receipt_at || null,
      recordVersion: row.record_version || "1",
    };
  const toNotification = (row) =>
    row && {
      id: row.id,
      userId: row.user_id,
      incidentId: row.incident_id || "",
      roomId: row.room_id || "",
      senderId: row.sender_id || "",
      message: row.message,
      incidentType: row.incident_type || "",
      read: Boolean(row.read),
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    };
  const toCamera = (row) =>
    row && {
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      lat: preserveUnknownCoordinate(row.lat),
      lng: preserveUnknownCoordinate(row.lng),
      state: row.state || "",
      lga: row.lga || "",
      ward: row.ward || "",
      pollingUnit: row.polling_unit || "",
      status: row.status,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    };
  const toMapLayer = (row) =>
    row && {
      id: row.id,
      name: row.name,
      type: row.type,
      data: row.data,
      url: row.url || "",
      bounds: row.bounds,
      opacity: Number(row.opacity ?? 0.65),
      fillOpacity: Number(row.fill_opacity ?? 0.18),
      category: row.category || (row.type === "raster" ? "Raster" : "Point"),
      operationalUse: row.operational_use || "Reference",
      color: row.color || "#facc15",
      fillColor: row.fill_color || "#f59e0b",
      lineWeight: Number(row.line_weight || 2),
      lineStyle: row.line_style || "solid",
      pointIcon: row.point_icon || "pin",
      pointIconColor: row.point_icon_color || "#ffffff",
      pointSize: Number(row.point_size ?? 2),
      showLabels: row.show_labels ?? true,
      labelField: row.label_field || "name",
      labelColor: row.label_color || "#3f0b1b",
      popupFields: row.popup_fields || "",
      visible: row.visible ?? true,
      zIndex: Number(row.z_index || 0),
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    };
  const toChatRoom = (row) =>
    row && {
      id: row.id,
      name: row.name,
      type: row.type || "room",
      incidentId: row.incident_id || "",
      createdBy: row.created_by || "",
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      members: row.members || [],
    };
  const toChatMessage = (row) =>
    row && {
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      body: row.body,
      attachments: row.attachments || [],
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    };


  return { toUser, toIncident, toResultRecord, toNotification, toCamera, toMapLayer, toChatRoom, toChatMessage };
}
