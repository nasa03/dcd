
namespace api.Models;

public class ExplorationWell
{
    public DrillingSchedule? DrillingSchedule { get; set; } = new();
    public Exploration Exploration { get; set; } = null!;
    public Guid ExplorationId { get; set; } = Guid.Empty!;
    public Well Well { get; set; } = null!;
    public Guid WellId { get; set; } = Guid.Empty!;
}
