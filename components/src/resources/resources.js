const REQUESTED_YOUTRACK_VERSION = '2018.1.41206';
const INDEPENDENT_BURNDOWN_REPORT_TYPE = 'jetbrains.youtrack.reports.impl.agile.burndown.gap.IndependentBurndownReport';

const SERVICE_FIELDS = 'id,name,applicationName,homeUrl,version';

const USER_FIELDS = 'id,ringId,login,name,avatarUrl,email';
const USER_GROUP_FIELDS = 'id,name,icon';
const PROJECTS_FIELDS = 'id,name,shortName';

const REPORT_FILTER_FIELDS_FIELDS = 'id,name,presentation';

const REPORT_FIELDS = `id,name,owner(${USER_FIELDS}),pinned,own,xaxis(id,field(${REPORT_FILTER_FIELDS_FIELDS})),yaxis(id,field(${REPORT_FILTER_FIELDS_FIELDS})),aggregationPolicy(id,field(${REPORT_FILTER_FIELDS_FIELDS})),xsortOrder,ysortOrder`;
const BURN_DOWN_REPORT_POINT = 'time,value';
const REPORT_WITH_DATA_FIELDS = `${REPORT_FIELDS},data(xlabel,ylabel,sprintFinish,remainingEffortPresentation,ideal(${BURN_DOWN_REPORT_POINT}),remainingEstimation(${BURN_DOWN_REPORT_POINT}),cumulativeSpentTime(${BURN_DOWN_REPORT_POINT}))`;
const REPORT_WITH_SETTINGS_FIELDS = `${REPORT_FIELDS},projects(${PROJECTS_FIELDS}),query,own,visibleTo(id,name)`;

const QUERY_ASSIST_FIELDS = 'query,caret,styleRanges(start,length,style),suggestions(options,prefix,option,suffix,description,matchingStart,matchingEnd,caret,completionStart,completionEnd,group,icon)';

const SPRINT_FIELDS = 'id,name,start,finish,report(id)';
const AGILE_FIELDS = `id,name,sprints(${SPRINT_FIELDS}),currentSprint(${SPRINT_FIELDS}),sprintsSettings(disableSprints,explicitQuery),columnSettings(field(id,name)),owner(id,ringId,fullName)`;

async function underlineAndSuggest(fetchYouTrack, query, caret) {
  return await fetchYouTrack(`api/search/assist?fields=${QUERY_ASSIST_FIELDS}`, {
    method: 'POST',
    body: {query, caret}
  });
}

async function loadProjects(fetchYouTrack) {
  return await fetchYouTrack(`api/admin/projects?fields=${PROJECTS_FIELDS}&$top=-1`);
}

async function loadAgiles(fetchYouTrack) {
  return await fetchYouTrack(`api/agiles?fields=${AGILE_FIELDS}&$top=-1`);
}

async function loadReportWithData(fetchYouTrack, reportId) {
  return await fetchYouTrack(
    `api/reports/${reportId}?fields=${REPORT_WITH_DATA_FIELDS}`
  );
}

async function loadReportWithSettings(fetchYouTrack, reportId) {
  return await fetchYouTrack(
    `api/reports/${reportId}?fields=${REPORT_WITH_SETTINGS_FIELDS}`
  );
}

async function loadIndependentBurnDownReports(fetchYouTrack) {
  return (
    await fetchYouTrack(`api/reports?fields=${REPORT_FIELDS}&$top=300&types=IndependentBurndownReport`)
  ) || [];
}

async function loadReportsAggregationFilterFields(fetchYouTrack, projects) {
  const fieldTypes = serializeArrayParameter(
    'fieldTypes', ['integer', 'float', 'period']
  );
  const fld = serializeArrayParameter('fld',
    (projects || []).map(project => project.id)
  );
  const params = [
    fieldTypes,
    fld,
    'includeNonFilterFields=true',
    '$top=300',
    'usage=true',
    `fields=${REPORT_FILTER_FIELDS_FIELDS}`
  ].filter(param => param.length > 0).join('&');

  const aggregationFilterFields = (await fetchYouTrack(`api/filterFields?${params}`)) || [];

  const configWithVotesPresentations = await fetchYouTrack('api/config?fields=l10n(predefinedQueries(votes))');
  const votersPresentation = configWithVotesPresentations &&
    configWithVotesPresentations.l10n &&
    configWithVotesPresentations.l10n.predefinedQueries &&
    configWithVotesPresentations.l10n.predefinedQueries.votes;

  if (votersPresentation) {
    return [{
      presentation: votersPresentation,
      id: votersPresentation,
      $type: 'jetbrains.charisma.keyword.PredefinedFilterField'
    }].concat(aggregationFilterFields);
  }
  return aggregationFilterFields;
}

function serializeArrayParameter(paramName, arr) {
  return encodeURI(
    arr.map(item => `${paramName}=${item}`).join('&')
  );
}

async function saveReportSettings(
  fetchYouTrack, report, isFullReportWithDataResponse
) {
  const reportIdPart = report.id ? `/${report.id}` : '';
  const fields = isFullReportWithDataResponse
    ? REPORT_WITH_DATA_FIELDS
    : REPORT_FIELDS;
  return await fetchYouTrack(`api/reports${reportIdPart}?fields=${fields}`, {
    method: 'POST',
    body: report
  });
}

async function recalculateReport(fetchYouTrack, report) {
  return await fetchYouTrack(`api/reports/${report.id}/status?fields=calculationInProgress,progress`, {
    method: 'POST',
    body: {
      calculationInProgress: true
    }
  });
}

async function loadUserGroups(fetchYouTrack) {
  return await fetchYouTrack(
    `api/admin/groups?fields=${USER_GROUP_FIELDS}`
  );
}

async function loadCurrentUser(fetchHub) {
  return await fetchHub(
    `api/rest/users/me?fields=${USER_FIELDS}`
  );
}

async function getYouTrackServices(fetchHub) {
  const data = await fetchHub(`api/rest/services?fields=${SERVICE_FIELDS}&query=applicationName:YouTrack`);
  return (data && data.services || []).filter(
    service => !!service.homeUrl && satisfyingVersion(service.version)
  );

  // eslint-disable-next-line complexity
  function satisfyingVersion(currentVersion) {
    const currentVersionTokens = currentVersion.split('.').map(Number);
    const requestedVersionTokens = REQUESTED_YOUTRACK_VERSION.
      split('.').map(Number);
    for (let i = 0; i < requestedVersionTokens.length; ++i) {
      if ((currentVersionTokens[i] > requestedVersionTokens[i]) ||
        (!isNaN(currentVersionTokens[i]) && isNaN(requestedVersionTokens[i]))
      ) {
        return true;
      }
      if (requestedVersionTokens[i] > currentVersionTokens[i] ||
        (isNaN(currentVersionTokens[i]) && !isNaN(requestedVersionTokens[i]))
      ) {
        return false;
      }
    }
    return true;
  }
}

async function getYouTrackService(fetchHub, optionalYtId) {
  let services = await getYouTrackServices(fetchHub);
  if (optionalYtId) {
    services = services.filter(service => service.id === optionalYtId);
  }
  return services[0];
}

function makeYouTrackFetcher(dashboardApi, youTrack) {
  return async (url, params) =>
    await dashboardApi.fetch(youTrack.id, url, params);
}

export {
  INDEPENDENT_BURNDOWN_REPORT_TYPE,

  loadReportWithData,
  loadIndependentBurnDownReports,
  loadReportWithSettings,
  loadReportsAggregationFilterFields,
  saveReportSettings,
  recalculateReport,
  getYouTrackServices,
  getYouTrackService,
  underlineAndSuggest,
  loadProjects,
  loadAgiles,
  loadUserGroups,
  loadCurrentUser,

  makeYouTrackFetcher
};