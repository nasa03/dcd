using System.Globalization;

using api.Adapters;
using api.Context;
using api.Dtos;
using api.Models;
using api.Services.GenerateCostProfiles;

using Microsoft.EntityFrameworkCore;

namespace api.Services;

public class CompareCasesService : ICompareCasesService
{
    private readonly IProjectService _projectService;
    private readonly ILogger<CompareCasesService> _logger;
    private readonly IExplorationService _explorationService;
    private readonly IDrainageStrategyService _drainageStrategyService;
    private readonly IGenerateCessationCostProfile _generateCessationCostProfile;
    private readonly IGenerateCo2EmissionsProfile _generateCo2EmissionsProfile;
    private readonly IGenerateGAndGAdminCostProfile _generateGAndGAdminCostProfile;
    private readonly IGenerateOpexCostProfile _generateOpexCostProfile;
    private readonly IGenerateStudyCostProfile _generateStudyCostProfile;

    public CompareCasesService(IProjectService projectService, ILoggerFactory loggerFactory, IExplorationService explorationService, IDrainageStrategyService drainageStrategyService,
    IGenerateGAndGAdminCostProfile generateGAndGAdminCostProfile, IGenerateStudyCostProfile generateStudyCostProfile, IGenerateOpexCostProfile generateOpexCostProfile,
    IGenerateCessationCostProfile generateCessationCostProfile, IGenerateCo2EmissionsProfile generateCo2EmissionsProfile)
    {
        _projectService = projectService;
        _logger = loggerFactory.CreateLogger<CompareCasesService>();
        _explorationService = explorationService;
        _drainageStrategyService = drainageStrategyService;

        _generateGAndGAdminCostProfile = generateGAndGAdminCostProfile;
        _generateStudyCostProfile = generateStudyCostProfile;
        _generateOpexCostProfile = generateOpexCostProfile;
        _generateCessationCostProfile = generateCessationCostProfile;
        _generateCo2EmissionsProfile = generateCo2EmissionsProfile;
    }

    public IEnumerable<CompareCasesDto> Calculate(Guid projectId)
    {
        var project = _projectService.GetProjectWithoutAssetsNoTracking(projectId);
        var caseList = new List<CompareCasesDto>();
        if (project.Cases != null)
        {
            DrainageStrategy drainageStrategy;
            Exploration exploration;
            foreach (var caseItem in project.Cases)
            {
                drainageStrategy = _drainageStrategyService.GetDrainageStrategy(caseItem.DrainageStrategyLink);
                exploration = _explorationService.GetExploration(caseItem.ExplorationLink);
                var generateCo2EmissionsProfile = _generateCo2EmissionsProfile.GenerateAsync(caseItem.Id).GetAwaiter().GetResult();

                var totalOilProduction = CalculateTotalOilProduction(caseItem, project, drainageStrategy, false);
                var totalGasProduction = CalculateTotalGasProduction(caseItem, project, drainageStrategy, false);
                var totalExportedVolumes = CalculateTotalExportedVolumes(caseItem, project, drainageStrategy, false);
                var totalStudyCostsPlusOpex = CalculateTotalStudyCostsPlusOpex(caseItem);
                var totalCessationCosts = CalculateTotalCessationCosts(caseItem);
                var offshorePlusOnshoreFacilityCosts = CalculateOffshorePlusOnshoreFacilityCosts(caseItem);
                var developmentCosts = CalculateDevelopmentWellCosts(caseItem);
                var explorationCosts = CalculateExplorationWellCosts(caseItem, exploration);
                var totalCo2Emissions = CalculateTotalCO2Emissions(caseItem, generateCo2EmissionsProfile);
                var co2Intensity = CalculateCO2Intensity(caseItem, project, drainageStrategy, generateCo2EmissionsProfile);

                var compareCases = new CompareCasesDto
                {
                    TotalOilProduction = totalOilProduction,
                    TotalGasProduction = totalGasProduction,
                    TotalExportedVolumes = totalExportedVolumes,
                    TotalStudyCostsPlusOpex = totalStudyCostsPlusOpex,
                    TotalCessationCosts = totalCessationCosts,
                    OffshorePlusOnshoreFacilityCosts = offshorePlusOnshoreFacilityCosts,
                    DevelopmentWellCosts = developmentCosts,
                    ExplorationWellCosts = explorationCosts,
                    TotalCo2Emissions = totalCo2Emissions,
                    Co2Intensity = co2Intensity,
                };
                caseList.Add(compareCases);
            }
        }
        return caseList;
    }

    private double CalculateTotalOilProduction(Case caseItem, Project project, DrainageStrategy drainageStrategy, Boolean excludeOilFieldConversion)
    {
        var sumOilProduction = 0.0;
        var million = 1E6;
        var bblConversionFactor = 6.29;
        try
        {
            if (drainageStrategy.ProductionProfileOil != null)
            {
                sumOilProduction += drainageStrategy.ProductionProfileOil.Values.Sum();
            }
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("DrainageStrategy {0} not found.", caseItem.DrainageStrategyLink);
        }

        if (project.PhysicalUnit != 0 && !excludeOilFieldConversion)
        {
            return sumOilProduction * bblConversionFactor / million;
        }

        return sumOilProduction / million;
    }

    private double CalculateTotalGasProduction(Case caseItem, Project project, DrainageStrategy drainageStrategy, Boolean excludeOilFieldConversion)
    {
        var sumGasProduction = 0.0;
        var billion = 1E9;
        var scfConversionFactor = 35.315;
        try
        {
            if (drainageStrategy.ProductionProfileGas != null)
            {
                sumGasProduction += drainageStrategy.ProductionProfileGas.Values.Sum();
            }
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("DrainageStrategy {0} not found.", caseItem.DrainageStrategyLink);
        }

        if (project.PhysicalUnit != 0 && !excludeOilFieldConversion)
        {
            return sumGasProduction * scfConversionFactor / billion;
        }

        return sumGasProduction / billion;
    }

    private double CalculateTotalExportedVolumes(Case caseItem, Project project, DrainageStrategy drainageStrategy, Boolean excludeOilFieldConversion)
    {
        var oilEquivalentFactor = 5.61;
        if (project.PhysicalUnit != 0 && !excludeOilFieldConversion)
        {
            return CalculateTotalOilProduction(caseItem, project, drainageStrategy, false) + CalculateTotalGasProduction(caseItem, project, drainageStrategy, false) / oilEquivalentFactor;
        }
        return CalculateTotalOilProduction(caseItem, project, drainageStrategy, true) + CalculateTotalGasProduction(caseItem, project, drainageStrategy, true);
    }

    private double CalculateTotalStudyCostsPlusOpex(Case caseItem)
    {
        var generateStudyProfile = _generateStudyCostProfile.GenerateAsync(caseItem.Id).GetAwaiter().GetResult();
        var generateOpexProfile = _generateOpexCostProfile.GenerateAsync(caseItem.Id).GetAwaiter().GetResult();
        var sumStudyValues = generateStudyProfile?.StudyCostProfileDto?.Sum ?? 0;
        var sumOpexValues = generateOpexProfile?.OpexCostProfileDto?.Sum ?? 0;

        return sumStudyValues + sumOpexValues;
    }

    private double CalculateTotalCessationCosts(Case caseItem)
    {
        var generateCessationProfile = _generateCessationCostProfile.GenerateAsync(caseItem.Id).GetAwaiter().GetResult();
        return generateCessationProfile?.CessationCostDto?.Sum ?? 0;
    }

    private double CalculateOffshorePlusOnshoreFacilityCosts(Case caseItem)
    {
        return _generateStudyCostProfile.SumAllCostFacility(caseItem);
    }

    private double CalculateDevelopmentWellCosts(Case caseItem)
    {
        return _generateStudyCostProfile.SumWellCost(caseItem);
    }

    private double CalculateExplorationWellCosts(Case caseItem, Exploration exploration)
    {
        var sumExplorationWellCost = 0.0;
        var generateGAndGAdminProfile = _generateGAndGAdminCostProfile.GenerateAsync(caseItem.Id).GetAwaiter().GetResult();
        sumExplorationWellCost += generateGAndGAdminProfile.Sum;

        try
        {
            if (exploration?.CountryOfficeCost != null)
            {
                sumExplorationWellCost += exploration.CountryOfficeCost.Values.Sum();
            }
            if (exploration?.SeismicAcquisitionAndProcessing != null)
            {
                sumExplorationWellCost += exploration.SeismicAcquisitionAndProcessing.Values.Sum();
            }
            if (exploration?.ExplorationWellCostProfile != null)
            {
                sumExplorationWellCost += exploration.ExplorationWellCostProfile.Values.Sum();
            }
            if (exploration?.AppraisalWellCostProfile != null)
            {
                sumExplorationWellCost += exploration.AppraisalWellCostProfile.Values.Sum();
            }
            if (exploration?.SidetrackCostProfile != null)
            {
                sumExplorationWellCost += exploration.SidetrackCostProfile.Values.Sum();
            }
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("Exploration {0} not found.", caseItem.ExplorationLink);
        }

        return sumExplorationWellCost;
    }

    private double CalculateTotalCO2Emissions(Case caseItem, Co2EmissionsDto generateCo2EmissionsProfile)
    {
        return generateCo2EmissionsProfile.Sum;
    }

    private double CalculateCO2Intensity(Case caseItem, Project project, DrainageStrategy drainageStrategy, Co2EmissionsDto generateCo2EmissionsProfile)
    {
        var tonnesToKgFactor = 1000;
        var boeConversionFactor = 6.29;
        var totalExportedVolumes = CalculateTotalExportedVolumes(caseItem, project, drainageStrategy, true);
        var totalCo2Emissions = CalculateTotalCO2Emissions(caseItem, generateCo2EmissionsProfile);
        if (totalExportedVolumes != 0 && totalCo2Emissions != 0)
        {
            return (totalCo2Emissions / totalExportedVolumes) / boeConversionFactor * tonnesToKgFactor;
        }
        return 0;
    }
}
