namespace Example;

public enum Fee { None, Reminder, Charge }

public static class Fees
{
    public static Fee LateFee(int daysLate, string membership) => daysLate switch
    {
        <= 0 => Fee.None,
        <= 14 => Fee.Reminder,
        _ => membership == "staff" ? Fee.Reminder : Fee.Charge
    };
}
