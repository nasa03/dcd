using api.Adapters;
using api.Dtos;
using api.Models;
using api.Services;

using Api.Authorization;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web.Resource;

namespace api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
[RequiredScope(RequiredScopesConfigurationKey = "AzureAd:Scopes")]
[RequiresApplicationRoles(
        ApplicationRole.Admin,
        ApplicationRole.ReadOnly,
        ApplicationRole.User

    )]
public class ExplorationsController : ControllerBase
{
    private readonly IExplorationService _explorationService;

    public ExplorationsController(IExplorationService explorationService)
    {
        _explorationService = explorationService;
    }

    [HttpPost(Name = "CreateExploration")]
    public ProjectDto CreateExploration([FromQuery] Guid sourceCaseId, [FromBody] ExplorationDto explorationDto)
    {
        return _explorationService.CreateExploration(explorationDto, sourceCaseId);
    }

    [HttpDelete("{explorationId}", Name = "DeleteExploration")]
    public ProjectDto DeleteExploration(Guid explorationId)
    {
        return _explorationService.DeleteExploration(explorationId);
    }

    [HttpPut(Name = "UpdateExploration")]
    public ProjectDto UpdateExploration([FromBody] ExplorationDto eplorationDto)
    {
        return _explorationService.UpdateExploration(eplorationDto);
    }

    [HttpPut("new", Name = "NewUpdateExploration")]
    public ExplorationDto NewUpdateExploration([FromBody] ExplorationDto eplorationDto)
    {
        return _explorationService.NewUpdateExploration(eplorationDto);
    }

    [HttpPost("{explorationId}/copy", Name = "CopyExploration")]
    public ExplorationDto CopyExploration([FromQuery] Guid caseId, Guid explorationId)
    {
        return _explorationService.CopyExploration(explorationId, caseId);
    }
}
