const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

function formatReverseLocation(payload = {}, lat, lng) {
  const address = payload.address || {};
  const namedPlace = clean(payload.name || address.amenity || address.building || address.school || address.office || address.shop);
  const street = clean([address.house_number, address.road || address.pedestrian || address.footway].filter(Boolean).join(' '));
  const locality = clean(address.neighbourhood || address.suburb || address.village || address.town || address.city || address.county);
  const label = namedPlace || street || locality || clean(payload.display_name)?.split(',')[0] || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  return {
    label: label.slice(0, 180),
    street: street.slice(0, 180),
    locality: locality.slice(0, 120),
    displayName: clean(payload.display_name).slice(0, 500),
    lat: Number(lat),
    lng: Number(lng),
    attribution: '© OpenStreetMap contributors',
  };
}

export { formatReverseLocation };
