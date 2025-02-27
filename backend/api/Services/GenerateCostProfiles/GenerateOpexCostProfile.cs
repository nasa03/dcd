using api.Adapters;
using api.Context;
using api.Dtos;
using api.Models;

namespace api.Services;

public class GenerateOpexCostProfile : IGenerateOpexCostProfile
{
    private readonly ICaseService _caseService;
    private readonly IProjectService _projectService;
    private readonly ILogger<GenerateOpexCostProfile> _logger;
    private readonly IDrainageStrategyService _drainageStrategyService;
    private readonly IWellProjectService _wellProjectService;
    private readonly ITopsideService _topsideService;
    private readonly DcdDbContext _context;

    public GenerateOpexCostProfile(DcdDbContext context, ILoggerFactory loggerFactory, ICaseService caseService, IProjectService projectService, IDrainageStrategyService drainageStrategyService,
        IWellProjectService wellProjectService, ITopsideService topsideService)
    {
        _context = context;
        _logger = loggerFactory.CreateLogger<GenerateOpexCostProfile>();
        _projectService = projectService;
        _drainageStrategyService = drainageStrategyService;
        _caseService = caseService;
        _wellProjectService = wellProjectService;
        _topsideService = topsideService;
    }

    public async Task<OpexCostProfileWrapperDto> GenerateAsync(Guid caseId)
    {
        var caseItem = _caseService.GetCase(caseId);
        var project = _projectService.GetProjectWithoutAssets(caseItem.ProjectId);
        var drainageStrategy = _drainageStrategyService.GetDrainageStrategy(caseItem.DrainageStrategyLink);

        var result = new OpexCostProfileWrapperDto();

        if (drainageStrategy == null)
        {
            throw new NotFoundInDBException(string.Format("DrainageStrategy {0} not found in database.", caseItem.DrainageStrategyLink));
        }

        var newWellInterventionCost = CalculateWellInterventionCostProfile(caseItem, project, drainageStrategy);
        var newOffshoreFacilitiesOperationsCost = CalculateOffshoreFacilitiesOperationsCostProfile(caseItem, drainageStrategy);

        var wellInterventionCost = caseItem.WellInterventionCostProfile ?? new WellInterventionCostProfile();
        wellInterventionCost.StartYear = newWellInterventionCost.StartYear;
        wellInterventionCost.Values = newWellInterventionCost.Values;

        var offshoreFacilitiesOperationsCost = caseItem.OffshoreFacilitiesOperationsCostProfile ?? new OffshoreFacilitiesOperationsCostProfile();
        offshoreFacilitiesOperationsCost.StartYear = newOffshoreFacilitiesOperationsCost.StartYear;
        offshoreFacilitiesOperationsCost.Values = newOffshoreFacilitiesOperationsCost.Values;

        var saveResult = await UpdateCaseAndSaveAsync(caseItem, wellInterventionCost, offshoreFacilitiesOperationsCost);

        var wellInterventionCostDto = CaseDtoAdapter.Convert<WellInterventionCostProfileDto, WellInterventionCostProfile>(wellInterventionCost);
        var offshoreFacilitiesOperationsCostDto = CaseDtoAdapter.Convert<OffshoreFacilitiesOperationsCostProfileDto, OffshoreFacilitiesOperationsCostProfile>(offshoreFacilitiesOperationsCost);

        result.WellInterventionCostProfileDto = wellInterventionCostDto;
        result.OffshoreFacilitiesOperationsCostProfileDto = offshoreFacilitiesOperationsCostDto;

        var OPEX = TimeSeriesCost.MergeCostProfiles(wellInterventionCost, offshoreFacilitiesOperationsCost);
        var opexCostProfile = new OpexCostProfile
        {
            StartYear = OPEX.StartYear,
            Values = OPEX.Values
        };
        var opexDto = CaseDtoAdapter.Convert<OpexCostProfileDto, OpexCostProfile>(opexCostProfile);
        result.OpexCostProfileDto = opexDto;
        return result;
    }

    private async Task<int> UpdateCaseAndSaveAsync(Case caseItem, WellInterventionCostProfile wellInterventionCostProfile, OffshoreFacilitiesOperationsCostProfile offshoreFacilitiesOperationsCostProfile)
    {
        caseItem.WellInterventionCostProfile = wellInterventionCostProfile;
        caseItem.OffshoreFacilitiesOperationsCostProfile = offshoreFacilitiesOperationsCostProfile;
        return await _context.SaveChangesAsync();
    }

    public WellInterventionCostProfile CalculateWellInterventionCostProfile(Case caseItem, Project project, DrainageStrategy drainageStrategy)
    {
        var lastYear = drainageStrategy?.ProductionProfileOil == null ? 0 : drainageStrategy.ProductionProfileOil.StartYear + drainageStrategy.ProductionProfileOil.Values.Length;

        WellProject wellProject;
        try
        {
            wellProject = _wellProjectService.GetWellProject(caseItem.WellProjectLink);
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("WellProject {0} not found.", caseItem.WellProjectLink);
            return new WellInterventionCostProfile();
        }
        var linkedWells = wellProject.WellProjectWells?.Where(ew => Well.IsWellProjectWell(ew.Well.WellCategory)).ToList();
        if (linkedWells == null) { return new WellInterventionCostProfile(); }

        var wellInterventionCostsFromDrillingSchedule = new TimeSeries<double>();
        foreach (var linkedWell in linkedWells)
        {
            if (linkedWell.DrillingSchedule == null) { continue; }

            var timeSeries = new TimeSeries<double>
            {
                StartYear = linkedWell.DrillingSchedule.StartYear,
                Values = linkedWell.DrillingSchedule.Values.Select(v => (double)v).ToArray()
            };
            wellInterventionCostsFromDrillingSchedule = TimeSeriesCost.MergeCostProfiles(wellInterventionCostsFromDrillingSchedule, timeSeries);
        }

        var tempSeries = new TimeSeries<int>
        {
            StartYear = wellInterventionCostsFromDrillingSchedule.StartYear,
            Values = wellInterventionCostsFromDrillingSchedule.Values.Select(v => (int)v).ToArray()
        };
        var cumulativeDrillingSchedule = GetCumulativeDrillingSchedule(tempSeries);
        cumulativeDrillingSchedule.StartYear = tempSeries.StartYear;

        var interventionCost = project.DevelopmentOperationalWellCosts?.AnnualWellInterventionCostPerWell ?? 0;

        var wellInterventionCostValues = cumulativeDrillingSchedule.Values.Select(v => v * interventionCost).ToArray();

        wellInterventionCostsFromDrillingSchedule.Values = wellInterventionCostValues;
        wellInterventionCostsFromDrillingSchedule.StartYear = cumulativeDrillingSchedule.StartYear;

        var totalValuesCount = lastYear == 0 ? wellInterventionCostsFromDrillingSchedule.Values.Length : lastYear - wellInterventionCostsFromDrillingSchedule.StartYear;
        var additionalValuesCount = totalValuesCount - wellInterventionCostsFromDrillingSchedule.Values.Length;

        var additionalValues = new List<double>();
        for (int i = 0; i < additionalValuesCount; i++)
        {
            if (wellInterventionCostsFromDrillingSchedule.Values.Length > 0)
            {
                additionalValues.Add(wellInterventionCostsFromDrillingSchedule.Values.Last());
            }
        }

        var valuesList = wellInterventionCostsFromDrillingSchedule.Values.ToList();
        valuesList.AddRange(additionalValues);

        wellInterventionCostsFromDrillingSchedule.Values = valuesList.ToArray();

        var result = new WellInterventionCostProfile
        {
            Values = wellInterventionCostsFromDrillingSchedule.Values,
            StartYear = wellInterventionCostsFromDrillingSchedule.StartYear,
        };

        return result;
    }

    public OffshoreFacilitiesOperationsCostProfile CalculateOffshoreFacilitiesOperationsCostProfile(Case caseItem, DrainageStrategy drainageStrategy)
    {
        if (drainageStrategy.ProductionProfileOil == null || drainageStrategy.ProductionProfileOil.Values.Length == 0) { return new OffshoreFacilitiesOperationsCostProfile() { Values = Array.Empty<double>() }; }
        var firstYear = drainageStrategy.ProductionProfileOil.StartYear;
        var lastYear = drainageStrategy.ProductionProfileOil.StartYear + drainageStrategy.ProductionProfileOil.Values.Length;

        Topside topside;
        try
        {
            topside = _topsideService.GetTopside(caseItem.TopsideLink);
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("Topside {0} not found.", caseItem.TopsideLink);
            return new OffshoreFacilitiesOperationsCostProfile() { Values = Array.Empty<double>() };
        }
        var facilityOpex = topside.FacilityOpex;
        var values = new List<double>
        {
            (facilityOpex - 1) / 8,
            (facilityOpex - 1) / 4,
            (facilityOpex - 1) / 2
        };

        for (int i = firstYear; i < lastYear; i++)
        {
            values.Add(facilityOpex);
        }
        const int preOpexCostYearOffset = 3;

        var offshoreFacilitiesOperationsCost = new OffshoreFacilitiesOperationsCostProfile
        {
            StartYear = firstYear - preOpexCostYearOffset,
            Values = values.ToArray()
        };
        return offshoreFacilitiesOperationsCost;
    }

    private static TimeSeries<double> GetCumulativeDrillingSchedule(TimeSeries<int> drillingSchedule)
    {
        var cumulativeSchedule = new TimeSeries<double>
        {
            StartYear = drillingSchedule.StartYear
        };
        var values = new List<double>();
        var sum = 0.0;
        for (int i = 0; i < drillingSchedule.Values.Length; i++)
        {
            sum += drillingSchedule.Values[i];
            values.Add(sum);
        }

        cumulativeSchedule.Values = values.ToArray();

        return cumulativeSchedule;
    }
}
