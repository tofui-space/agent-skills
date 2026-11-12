namespace Example;

public enum Membership { Standard = 1, Staff = 2 }

public enum Period { Refused, TwoWeeks, FourWeeks }

public static class Lending
{
    public static Period LoanPeriod(Membership membership, bool reference) => reference
        ? Period.Refused
        : membership switch
        {
            Membership.Standard => Period.TwoWeeks,
            Membership.Staff => Period.FourWeeks,
            _ => Period.Refused
        };
}
