namespace Example;

public static class Decision
{
    public static bool CanBorrow(bool available, bool suspended) => available && !suspended;
}
