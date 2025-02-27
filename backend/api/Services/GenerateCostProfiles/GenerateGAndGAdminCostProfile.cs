using System.Globalization;

using api.Adapters;
using api.Context;
using api.Dtos;
using api.Models;


namespace api.Services;

public class GenerateGAndGAdminCostProfile : IGenerateGAndGAdminCostProfile
{
    private readonly IProjectService _projectService;
    private readonly ICaseService _caseService;
    private readonly ILogger<GenerateGAndGAdminCostProfile> _logger;
    private readonly IExplorationService _explorationService;
    private readonly DcdDbContext _context;

    public GenerateGAndGAdminCostProfile(DcdDbContext context, ILoggerFactory loggerFactory, IProjectService projectService, ICaseService caseService, IExplorationService explorationService)
    {
        _context = context;
        _projectService = projectService;
        _logger = loggerFactory.CreateLogger<GenerateGAndGAdminCostProfile>();
        _caseService = caseService;
        _explorationService = explorationService;
    }

    public async Task<GAndGAdminCostDto> GenerateAsync(Guid caseId)
    {
        var caseItem = _caseService.GetCase(caseId);

        Exploration exploration;
        try
        {
            exploration = _explorationService.GetExploration(caseItem.ExplorationLink);
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("Exploration {0} not found.", caseItem.ExplorationLink);
            return new GAndGAdminCostDto();
        }
        var linkedWells = exploration.ExplorationWells?.Where(ew => ew.Well.WellCategory == WellCategory.Exploration_Well).ToList();
        if (exploration != null && linkedWells?.Count > 0)
        {
            var drillingSchedules = linkedWells.Select(lw => lw.DrillingSchedule);
            var earliestYear = drillingSchedules.Select(ds => ds?.StartYear)?.Min() + caseItem.DG4Date.Year;
            var dG1Date = caseItem.DG1Date;
            if (earliestYear != null && dG1Date.Year >= earliestYear)
            {
                var project = _projectService.GetProject(caseItem.ProjectId);
                var country = project.Country;
                var countryCost = MapCountry(country);
                var lastYear = new DateTimeOffset(dG1Date.Year, 1, 1, 0, 0, 0, 0, new GregorianCalendar(), TimeSpan.Zero);
                var lastYearMinutes = (dG1Date - lastYear).TotalMinutes;

                var totalMinutesLastYear = new TimeSpan(365, 0, 0, 0).TotalMinutes;
                var percentageOfLastYear = lastYearMinutes / totalMinutesLastYear;

                var gAndGAdminCost = exploration.GAndGAdminCost ?? new GAndGAdminCost();

                gAndGAdminCost.StartYear = (int)earliestYear - caseItem.DG4Date.Year;

                var years = lastYear.Year - (int)earliestYear;
                var values = new List<double>();
                for (int i = 0; i < years; i++)
                {
                    values.Add(countryCost);
                }
                values.Add(countryCost * percentageOfLastYear);
                gAndGAdminCost.Values = values.ToArray();

                var saveResult = await UpdateExplorationAndSaveAsync(exploration, gAndGAdminCost);

                return ExplorationDtoAdapter.Convert(gAndGAdminCost);
            }
        }
        return new GAndGAdminCostDto();
    }

    private async Task<int> UpdateExplorationAndSaveAsync(Exploration exploration, GAndGAdminCost gAndGAdminCost)
    {
        exploration.GAndGAdminCost = gAndGAdminCost;
        return await _context.SaveChangesAsync();
    }

    private static double MapCountry(string country)
    {
        return country switch
        {
            "NORWAY" => 1,
            "UK" => 1,
            "BRAZIL" => 3,
            "CANADA" => 3,
            "UNITED STATES" => 3,
            _ => 7.0,
        };
    }
}
