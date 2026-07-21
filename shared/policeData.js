export const POLICE_RANK_GROUPS = [
  { name: 'Election Operations', ranks: ['Admin', 'Response Team', 'Agent'] }
];

export const POLICE_RANKS = POLICE_RANK_GROUPS.flatMap(group => group.ranks);
export const rankLevel = rank => {
  if (rank === 'Super Admin') return -1;
  const index = POLICE_RANKS.indexOf(rank);
  return index < 0 ? POLICE_RANKS.length : index;
};
export const ranksBelow = rank => POLICE_RANKS.slice(Math.max(rankLevel(rank) + 1, 0));
export const canManageRank = (viewerRank, targetRank) => rankLevel(viewerRank) < rankLevel(targetRank);

export const OYO_POLICE_UNITS = [
  ['Ogbere','Division','Ona-Ara','Agodi AC'],['Egbeda','Division','Egbeda','Agodi AC'],['Akobo','Division','Ibadan North','Agodi AC'],['Ashi','Division','Ibadan North','Agodi AC'],['Bodija','Division','Ibadan North','Agodi AC'],['Bodija Mkt','Division','Ibadan North','Agodi AC'],['Yemetu','Division','Ibadan North','Agodi AC'],['Ikolaba','Division','Ibadan North','Agodi AC'],['Idi-Aro','Division','IBSE','Agodi AC'],['Agugu','Division','IBSE','Agodi AC'],['Ogungbade','Division','Egbeda','Agodi AC'],['Olorunda Aba','Division','Lagelu','Agodi AC'],['Agodi','Area Command','IBNE','Agodi Area Command'],
  ['Apete','Division','Ido','Apata AC'],['Eleyele','Division','IBNW','Apata AC'],['Oluyole','Division','IBSW','Apata AC'],['Omi- Adio','Division','Ido','Apata AC'],['Kuola','Division','Ido','Apata AC'],['Oke Alaro','Division','Oluyole','Apata AC'],['Apata','Area Command','Oluyole','Apata Area Command'],
  ['Ayete','Division','Ibarapa North','Eruwa AC'],['Igbo-Ora','Area Command','Ibarapa Central','Eruwa AC'],['Lanlate','Division','Ibarapa East','Eruwa AC'],['Ile-Ido','Division','Ido','Eruwa AC'],['Igangan','Division','Ibarapa North','Eruwa AC'],['Eruwa','Area Command','Ibarapa East','Eruwa Area Command'],
  ['Iwere-ile','Division','Iwajowa','Iganna AC'],['Okeho','Division','Kajola','Iganna AC'],['Ilero','Division','Kajola','Iganna AC'],['Ijio','Division','Iwajowa','Iganna AC'],['Iganna','Area Command','Iwajowa','Iganna Area Command'],
  ['Igboho','Division','Orelope','Igbeti AC'],['Kishi','Division','Irepo','Igbeti AC'],['Igbeti','Area Command','Olorunsogo','Igbeti Area Command'],
  ['Otu','Division','Itesiwaju','Iseyin AC'],['Okaka','Division','Itesiwaju','Iseyin AC'],['Komu','Division','Itesiwaju','Iseyin AC'],['Ipapo','Division','Itesiwaju','Iseyin AC'],['Iseyin','Area Command','Iseyin','Iseyin Area Command'],
  ['Challenge','Division','Oluyole','Iyaganku AC'],['Idi-Ayunre','Division','Oluyole','Iyaganku AC'],['Felele','Division','Oluyole','Iyaganku AC'],['Akanran','Division','Ona-Ara','Iyaganku AC'],['Mokola','Division','IBN','Iyaganku AC'],['Toll gate','Division','IBSW','Iyaganku AC'],['Sanyo','Division','IBSE','Iyaganku AC'],['Mapo','Division','IBSE','Iyaganku AC'],['Iyaganku','Area Command','IBSW','Iyaganku Area Command'],
  ['Ojoo','Division','Akinyele','Moniya AC'],['Monatan','Division','Lagelu','Moniya AC'],['Iyana Offa','Division','Lagelu','Moniya AC'],['Kajorepo','Division','Akinyele','Moniya AC'],['Alakia-Adelubi','Division','Egbeda','Moniya AC'],['Sango','Division','Ibadan North','Moniya AC'],['Moniya','Area Command','Akinyele','Moniya Area Command'],
  ['Ikoyi-ile','Division','Ori-Ire','Ogbomoso AC'],['Arowomole','Division','Ogbomoso South','Ogbomoso AC'],['Iresaadu','Division','Surulere','Ogbomoso AC'],['Ajawaa','Division','Ogo-Oluwa','Ogbomoso AC'],['Orile Igbon','Division','Surulere','Ogbomoso AC'],['Opete','Division','Ogo Oluwa','Ogbomoso AC'],['Oko','Division','Surulere','Ogbomoso AC'],['Iresaapa','Division','Surulere','Ogbomoso AC'],['Okin-Apa','Division','Ogo Oluwa','Ogbomoso AC'],['Owode-Ogbomoso','Area Command','Ogbomoso North','Ogbomoso Area Command'],
  ['Atiba','Division','Atiba','Oyo AC'],['Ojongbodu','Division','Oyo West','Oyo AC'],['Jobele','Division','Afijio','Oyo AC'],['Awe','Division','Afijio','Oyo AC'],['Ilora','Division','Afijio','Oyo AC'],['Durbar','Area Command','Oyo East','Oyo Area Command'],
  ['Ago Amodu','Division','Saki East','Saki AC'],['Ogboro','Division','Saki East','Saki AC'],['Ago Are','Division','Atisbo','Saki AC'],['Ado Awaiye','Division','Iseyin','Saki AC'],['Saki','Area Command','Saki West','Saki Area Command']
].map(([name, type, lga, command]) => ({ name, type, lga, command }));

export const normalizeCommand = command => String(command || '').replace(/\s*Area Command$/i, ' AC').trim();
export const OYO_COMMANDS = [...new Set(OYO_POLICE_UNITS.map(unit => normalizeCommand(unit.command)))].sort();
export const divisionsForCommand = command => OYO_POLICE_UNITS.filter(unit => normalizeCommand(unit.command) === normalizeCommand(command) && unit.type === 'Division');
export const UNIT_TYPES = ['HQTS', 'Special Unit', 'Area Command', 'Division', 'Station'];
