const ReportModel = {
  ErrorTypes: {
    OK: 0,
    UNKNOWN_ERROR: 1,
    NO_YOUTRACK: 2,
    NO_REPORT: 3,
    CANNOT_LOAD_REPORT: 4
  },

  isReportCalculation: report =>
    report && report.status && report.status.calculationInProgress,

  isReportCalculationCompleted: (updatedReport, prevReport) =>
    ReportModel.isReportCalculation(prevReport) &&
    !ReportModel.isReportCalculation(updatedReport),

  isReportError: report =>
    report && report.status && report.status.error,

  isTooBigReportDataError: report =>
    (report.data || {}).tooBig,

  isNoReportDataError: report => {
    if (ReportModel.isTooBigReportDataError(report)) {
      return false;
    }
    const reportData = report.data || {};
    return !(reportData.columns || reportData.ycolumns || []).length;
  }
};

export default ReportModel;
