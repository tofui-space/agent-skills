namespace Example;

public enum Standing { Good, Suspended }

public readonly record struct Loan(int Id, double DailyRate, int DaysLate, double Fee, Standing Standing);

public readonly record struct Step(double Days);

public readonly struct AccrueFee
{
    public Loan Apply(in Loan loan, in Step step) => loan.DaysLate switch
    {
        <= 0 => loan,
        <= 14 => loan with { Fee = loan.Fee + loan.DailyRate * step.Days },
        _ => loan with { Fee = loan.Fee + loan.DailyRate * step.Days * 2, Standing = Standing.Suspended },
    };
}
