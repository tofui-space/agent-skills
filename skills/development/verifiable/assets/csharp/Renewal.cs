namespace Example;

public enum Membership { Standard = 1, Staff = 2 }

public readonly record struct RenewalRequest(Membership Membership, bool Overdue, bool Reserved);

public static class Renewals
{
    public static bool CanRenew(RenewalRequest request) => request switch
    {
        { Reserved: true } => false,
        { Membership: Membership.Staff } => true,
        { Membership: Membership.Standard, Overdue: false } => true,
        _ => false
    };
}
