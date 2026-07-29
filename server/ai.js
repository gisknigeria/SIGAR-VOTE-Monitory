function summarizeNewsLocally(articles = []) {
  const headlines = (articles || [])
    .map((item) => String(item?.title || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  if (!headlines.length) return 'No recent headlines were available for AI summarization.';

  const mentionsInec = headlines.some((headline) => /inec|polling|ballot|vote/i.test(headline));
  const mentionsSecurity = headlines.some((headline) => /security|violence|thugg|attack|sos|incident/i.test(headline));
  const mentionsLogistics = headlines.some((headline) => /late|delay|bvas|battery|network|material|register/i.test(headline));

  const themes = [];
  if (mentionsInec) themes.push('election administration and polling operations');
  if (mentionsSecurity) themes.push('security and incident response');
  if (mentionsLogistics) themes.push('logistics and equipment readiness');

  const themeText = themes.length ? themes.join(', ') : 'operational readiness';
  return `Local summary: the headline set points most strongly to ${themeText}. This is operationally relevant for Ibadan and INEC follow-up work, so prioritize field verification for any reported disruptions, confirm facts with official channels, and monitor follow-up coverage before acting on the stories.`;
}

function analyzeContextLocally(context = {}) {
  const incidents = Array.isArray(context.incidents) ? context.incidents : [];
  const critical = incidents.filter((incident) => incident?.severity === 'Critical' || incident?.reportType === 'SOS-Emergency').length;
  const open = incidents.filter((incident) => !['Resolved', 'Submitted'].includes(incident?.status)).length;
  const coverage = Number(context.coverage || 0);
  const leader = context.leader || 'the leading party';

  const bullets = [];
  if (critical) bullets.push(`${critical} critical or SOS incident${critical === 1 ? '' : 's'} needs immediate attention.`);
  if (open > critical) bullets.push(`${open - critical} additional open incident${open - critical === 1 ? '' : 's'} should be reviewed.`);
  if (coverage < 10) bullets.push(`Coverage is still low at ${coverage} submitted units; treat the projection with caution.`);
  else bullets.push(`Coverage is reasonably healthy at ${coverage} submitted units.`);
  bullets.push(`${leader} is the current lead in the available data, but confirmation is still needed from missing units.`);

  return `Local analysis: ${bullets.join(' ')} Keep the operation focused on verification, incident triage, and evidence collection.`;
}

export { summarizeNewsLocally, analyzeContextLocally };
