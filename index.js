"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var core = require("@actions/core");
var xlsx = require("xlsx");
var rest_1 = require("@octokit/rest");
var quick_pivot_1 = require("quick-pivot");
var graphql_1 = require("@octokit/graphql");
function generateSecurityReportForRepo(repo, token) {
    return __awaiter(this, void 0, void 0, function () {
        var octokit, login, repoName, dgIssues, csIssues, dgInfo, secretScanningAlerts, dgPivotData, csPivotData, wb, ws, ws1, ws2, ws3, ws4, ws5, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    if (!token) {
                        core.error('Please set the INPUT_TOKEN env variable');
                        return [2 /*return*/];
                    }
                    octokit = new rest_1.Octokit({ auth: token });
                    login = '';
                    repoName = '';
                    if (repo) {
                        login = repo.split('/')[0];
                        repoName = repo.split('/')[1];
                    }
                    else {
                        core.error('Could not find repo, please set the GITHUB_REPOSITORY env variable');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getDependabotReport(login, repoName, token)];
                case 1:
                    dgIssues = _a.sent();
                    return [4 /*yield*/, getCodeScanningReport(login, repoName, octokit)];
                case 2:
                    csIssues = _a.sent();
                    return [4 /*yield*/, getDependencyGraphReport(login, repoName, token)];
                case 3:
                    dgInfo = _a.sent();
                    return [4 /*yield*/, getSecretScanningReport(octokit, login, repoName)];
                case 4:
                    secretScanningAlerts = _a.sent();
                    dgPivotData = generatePivot(['manifest'], ['licenseInfo'], 'packageName', 'count', dgInfo);
                    csPivotData = generatePivot(['cwe'], ['severity'], 'html_url', 'count', csIssues);
                    wb = xlsx.utils.book_new();
                    ws = xlsx.utils.aoa_to_sheet(csIssues);
                    ws1 = xlsx.utils.aoa_to_sheet(dgInfo);
                    ws2 = xlsx.utils.aoa_to_sheet(dgPivotData);
                    ws3 = xlsx.utils.aoa_to_sheet(csPivotData);
                    ws4 = xlsx.utils.aoa_to_sheet(secretScanningAlerts);
                    ws5 = xlsx.utils.aoa_to_sheet(dgIssues);
                    xlsx.utils.book_append_sheet(wb, ws, 'code-scanning-issues');
                    xlsx.utils.book_append_sheet(wb, ws1, 'dependencies-list');
                    xlsx.utils.book_append_sheet(wb, ws2, 'dependencies-license-pivot');
                    xlsx.utils.book_append_sheet(wb, ws3, 'code-scanning-Pivot');
                    xlsx.utils.book_append_sheet(wb, ws4, 'secret-scanning-alerts');
                    xlsx.utils.book_append_sheet(wb, ws5, 'software-composition-analysis');
                    xlsx.writeFile(wb, "".concat(repo.replace('/', '-'), "-alerts.xlsx"));
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    if (error_1 instanceof Error)
                        core.setFailed(error_1.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getSecretScanningReport(octokit, login, repoName) {
    return __awaiter(this, void 0, void 0, function () {
        var csvData, secretScanningAlerts, header, _i, secretScanningAlerts_1, alert_1, row, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    csvData = [];
                    return [4 /*yield*/, octokit.paginate(octokit.rest.secretScanning.listAlertsForRepo, {
                            owner: login,
                            repo: repoName
                        })];
                case 1:
                    secretScanningAlerts = _a.sent();
                    header = [
                        'html_url',
                        'secret_type',
                        'secret',
                        'state',
                        'resolution'
                    ];
                    csvData.push(header);
                    for (_i = 0, secretScanningAlerts_1 = secretScanningAlerts; _i < secretScanningAlerts_1.length; _i++) {
                        alert_1 = secretScanningAlerts_1[_i];
                        row = [
                            alert_1.html_url,
                            alert_1.secret_type,
                            alert_1.secret,
                            alert_1.state,
                            alert_1.resolution
                        ];
                        csvData.push(row);
                    }
                    return [2 /*return*/, csvData];
                case 2:
                    error_2 = _a.sent();
                    if (error_2 instanceof Error) {
                        core.error(error_2.message);
                        return [2 /*return*/, [[error_2.message, '', '', '', '']]];
                    }
                    return [2 /*return*/, [[]]];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generatePivot(rowHeader, colHeader, aggregationHeader, aggregator, dgInfo) {
    var aggregationDimensions = ["".concat(aggregationHeader)];
    var pivot = new quick_pivot_1.default(dgInfo, rowHeader, colHeader, aggregationDimensions, aggregator);
    var pivotData = [];
    for (var _i = 0, _a = pivot.data.table; _i < _a.length; _i++) {
        var row = _a[_i];
        var pivotRow = [];
        for (var _b = 0, _c = row.value; _b < _c.length; _b++) {
            var col = _c[_b];
            pivotRow.push(col);
        }
        pivotData.push(pivotRow);
    }
    return pivotData;
}
function getCodeScanningReport(login, repoName, octokit) {
    return __awaiter(this, void 0, void 0, function () {
        var data, csvData, header, _i, data_1, alert_2, rule, securitySeverity, securityCwe, _a, _b, cwe, _alert, row, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, octokit.paginate(octokit.rest.codeScanning.listAlertsForRepo, {
                            owner: login,
                            repo: repoName
                        })];
                case 1:
                    data = _c.sent();
                    csvData = [];
                    header = [
                        'toolName',
                        'toolVersion',
                        'alertNumber',
                        'htmlUrl',
                        'state',
                        'rule',
                        'cwe',
                        'severity',
                        'location',
                        'start-line',
                        'end-line',
                        'createdAt',
                        'updatedAt',
                        'fixedAt',
                        'dismissedAt',
                        'dismissedBy'
                    ];
                    csvData.push(header);
                    for (_i = 0, data_1 = data; _i < data_1.length; _i++) {
                        alert_2 = data_1[_i];
                        rule = alert_2.rule;
                        securitySeverity = '';
                        securityCwe = '';
                        if (rule.security_severity_level) {
                            securitySeverity = rule.security_severity_level;
                        }
                        else {
                            securitySeverity = rule.severity;
                        }
                        for (_a = 0, _b = rule.tags; _a < _b.length; _a++) {
                            cwe = _b[_a];
                            if (cwe.includes('external/cwe/cwe')) {
                                securityCwe = "".concat(securityCwe).concat(cwe, ", ");
                            }
                        }
                        securityCwe = securityCwe.replace(/,\s*$/, '');
                        _alert = alert_2;
                        row = [
                            alert_2.tool.name,
                            alert_2.tool.version,
                            alert_2.number.toString(),
                            alert_2.html_url,
                            alert_2.state,
                            rule.id,
                            securityCwe,
                            securitySeverity,
                            alert_2.most_recent_instance.location.path,
                            alert_2.most_recent_instance.location.start_line,
                            alert_2.most_recent_instance.location.end_line,
                            alert_2.created_at,
                            _alert.updated_at,
                            _alert.fixed_at,
                            alert_2.dismissed_at,
                            alert_2.dismissed_by
                        ];
                        csvData.push(row);
                    }
                    return [2 /*return*/, csvData];
                case 2:
                    error_3 = _c.sent();
                    if (error_3 instanceof Error) {
                        core.error(error_3.message);
                        return [2 /*return*/, [[error_3.message]]];
                    }
                    return [2 /*return*/, [[]]];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getDependencyGraphReport(login, repoName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var response, csvData, header, _i, _a, dependency, _b, _c, dependencyEdge, licenseInfo, row, error_4;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, graphql_1.graphql)("\n      {\n        repository(owner: \"".concat(login, "\", name: \"").concat(repoName, "\") {\n          name\n          licenseInfo {\n            name\n          }\n          dependencyGraphManifests {\n            totalCount\n            edges {\n              node {\n                filename\n                dependencies {\n                  edges {\n                    node {\n                      packageName\n                      packageManager\n                      requirements\n                      repository {\n                        licenseInfo {\n                          name\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    "), {
                            headers: {
                                authorization: "token ".concat(token),
                                accept: 'application/vnd.github.hawkgirl-preview+json'
                            }
                        })];
                case 1:
                    response = _d.sent();
                    csvData = [];
                    header = [
                        'manifest',
                        'packageName',
                        'packageManager',
                        'requirements',
                        'licenseInfo'
                    ];
                    csvData.push(header);
                    for (_i = 0, _a = response.repository.dependencyGraphManifests.edges; _i < _a.length; _i++) {
                        dependency = _a[_i];
                        for (_b = 0, _c = dependency.node.dependencies.edges; _b < _c.length; _b++) {
                            dependencyEdge = _c[_b];
                            licenseInfo = '';
                            if (dependencyEdge.node &&
                                dependencyEdge.node.repository &&
                                dependencyEdge.node.repository.licenseInfo) {
                                licenseInfo = dependencyEdge.node.repository.licenseInfo.name;
                            }
                            row = [
                                dependency.node.filename,
                                dependencyEdge.node.packageName,
                                dependencyEdge.node.packageManager,
                                dependencyEdge.node.requirements,
                                licenseInfo
                            ];
                            csvData.push(row);
                        }
                    }
                    return [2 /*return*/, csvData];
                case 2:
                    error_4 = _d.sent();
                    if (error_4 instanceof Error) {
                        core.error(error_4.message);
                        return [2 /*return*/, [[error_4.message]]];
                    }
                    return [2 /*return*/, [[]]];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getDependabotReport(login, repoName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var csvData, header, response, after, _i, _a, dependency, version, row, error_5;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    csvData = [];
                    header = [
                        'ghsaId',
                        'packageName',
                        'packageManager',
                        'severity',
                        'firstPatchedVersion',
                        'description'
                    ];
                    csvData.push(header);
                    response = void 0;
                    after = '';
                    _b.label = 1;
                case 1: return [4 /*yield*/, fetchAPIResults(login, repoName, after, token)];
                case 2:
                    response = _b.sent();
                    after = response.repository.vulnerabilityAlerts.pageInfo.endCursor;
                    for (_i = 0, _a = response.repository.vulnerabilityAlerts.nodes; _i < _a.length; _i++) {
                        dependency = _a[_i];
                        version = 'na';
                        if (dependency.securityVulnerability.firstPatchedVersion != null)
                            version =
                                dependency.securityVulnerability.firstPatchedVersion.identifier;
                        row = [
                            dependency.securityVulnerability.advisory.ghsaId,
                            dependency.securityVulnerability.package.name,
                            dependency.securityVulnerability.package.ecosystem,
                            dependency.securityVulnerability.advisory.severity,
                            version,
                            dependency.securityVulnerability.advisory.description
                        ];
                        csvData.push(row);
                    }
                    _b.label = 3;
                case 3:
                    if (response.repository.vulnerabilityAlerts.pageInfo.hasNextPage) return [3 /*break*/, 1];
                    _b.label = 4;
                case 4: return [2 /*return*/, csvData];
                case 5:
                    error_5 = _b.sent();
                    if (error_5 instanceof Error) {
                        core.error(error_5.message);
                        return [2 /*return*/, [[error_5.message]]];
                    }
                    return [2 /*return*/, [[]]];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function fetchAPIResults(login, repoName, after, token) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, graphql_1.graphql)(getQuery(login, repoName, after), {
                            headers: {
                                authorization: "token ".concat(token),
                                accept: 'application/vnd.github.hawkgirl-preview+json'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
                case 2:
                    error_6 = _a.sent();
                    if (error_6 instanceof Error) {
                        core.error(error_6.message);
                        return [2 /*return*/, {}];
                    }
                    return [2 /*return*/, {}];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getQuery(login, repoName, after) {
    var query = "\n      {\n        repository(owner: \"".concat(login, "\", name: \"").concat(repoName, "\") {\n          vulnerabilityAlerts(first: 100 ").concat(after ? ", after: \"".concat(after, "\"") : '', ") {\n            nodes {\n              createdAt\n              dismissedAt\n              securityVulnerability {\n                package {\n                  name\n                  ecosystem\n                }\n                advisory {\n                  description\n                  permalink\n                  severity\n                  ghsaId\n                }\n                firstPatchedVersion {\n                  identifier\n                }\n              }\n            }\n            totalCount\n            pageInfo {\n              hasNextPage\n              endCursor\n            }\n          }\n        }\n      }\n    ");
    return query;
}
function generateSecurityReportForOrganization(organization, token) {
    return __awaiter(this, void 0, void 0, function () {
        var octokit, repos, _i, repos_1, repo, repoName, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    if (!token) {
                        core.error('Please set the INPUT_TOKEN env variable');
                        return [2 /*return*/];
                    }
                    octokit = new rest_1.Octokit({ auth: token });
                    return [4 /*yield*/, octokit.paginate(octokit.rest.repos.listForOrg, {
                            org: organization
                        })];
                case 1:
                    repos = _a.sent();
                    _i = 0, repos_1 = repos;
                    _a.label = 2;
                case 2:
                    if (!(_i < repos_1.length)) return [3 /*break*/, 5];
                    repo = repos_1[_i];
                    repoName = "".concat(repo.owner.login, "/").concat(repo.name);
                    return [4 /*yield*/, generateSecurityReportForRepo(repoName, token)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_7 = _a.sent();
                    if (error_7 instanceof Error)
                        core.setFailed(error_7.message);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var token, organization;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = core.getInput('token');
                    organization = core.getInput('organization');
                    if (!organization) {
                        core.error('Please provide the organization name');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, generateSecurityReportForOrganization(organization, token)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
run();
