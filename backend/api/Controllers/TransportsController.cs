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
public class TransportsController : ControllerBase
{
    private readonly ITransportService _transportService;

    public TransportsController(ITransportService transportService)
    {
        _transportService = transportService;
    }

    [HttpPut(Name = "UpdateTransport")]
    public ProjectDto UpdateTransport([FromBody] TransportDto transportDto)
    {
        return _transportService.UpdateTransport(transportDto);
    }

    [HttpPut("new", Name = "NewUpdateTransport")]
    public TransportDto NewUpdateTransport([FromBody] TransportDto transportDto)
    {
        return _transportService.NewUpdateTransport(transportDto);
    }

    [HttpPost(Name = "CreateTransport")]
    public ProjectDto CreateTransport([FromQuery] Guid sourceCaseId, [FromBody] TransportDto transportDto)
    {
        return _transportService.CreateTransport(transportDto, sourceCaseId);
    }

    [HttpDelete("{transportId}", Name = "DeleteTransport")]
    public ProjectDto DeleteTransport(Guid transportId)
    {
        return _transportService.DeleteTransport(transportId);
    }

    [HttpPost("{transportId}/copy", Name = "CopyTransport")]
    public TransportDto CopyTransport([FromQuery] Guid caseId, Guid transportId)
    {
        return _transportService.CopyTransport(transportId, caseId);
    }
}
